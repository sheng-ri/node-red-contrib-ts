import { NodeAPI, Node, NodeDef } from 'node-red';
import * as vm from 'vm';
import ts from 'typescript';
import util from 'util';

export interface TypeScriptNodeDef extends NodeDef {
    name: string;
    script: string;
    outputs: number;
    useVm: boolean;
    libs?: Array<{var: string, module: string}>;
}

interface Compilation {
    script: string;
    useVm: boolean;
    exec: (msg: any) => Promise<any[]>,
}

function compileTypeScript(node: Node, script: string): string {
    try {
        node.log(`Compiling TypeScript (${script.length} chars)`);
        
        const result = ts.transpileModule(script, {
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS,
                moduleResolution: ts.ModuleResolutionKind.NodeJs,
                
                // Maximum permissiveness - allow everything
                allowJs: true,
                allowUnreachableCode: true,
                allowUnusedLabels: true,
                
                // Disable all strict checks
                strict: false,
                noImplicitAny: false,
                noImplicitThis: false,
                noImplicitReturns: false,
                noImplicitUseStrict: false,
                
                // Disable all error checking
                noUnusedLocals: false,
                noUnusedParameters: false,
                exactOptionalPropertyTypes: false,
                noUncheckedIndexedAccess: false,
                noPropertyAccessFromIndexSignature: false,
                
                // Skip all lib and declaration checks
                skipLibCheck: true,
                skipDefaultLibCheck: true,
                
                // Suppress warnings and errors
                suppressExcessPropertyErrors: true,
                suppressImplicitAnyIndexErrors: true,
                
                // Allow all JS features
                allowSyntheticDefaultImports: true,
                allowUmdGlobalAccess: true,
                
                // Disable emit checks
                noEmitOnError: false,
                
                // Maximum compatibility
                downlevelIteration: true,
                importHelpers: false
            }
        });
        
        // Check for TypeScript diagnostics
        if (result.diagnostics && result.diagnostics.length > 0) {
            const errors = result.diagnostics.map(diagnostic => {
                const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                if (diagnostic.file && diagnostic.start !== undefined) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                    return `Line ${line + 1}:${character + 1}: ${message}`;
                }
                return message;
            }).join('\n');
            
            node.error(`TypeScript diagnostics:\n${errors}`);
        }
        
        node.log('TypeScript compilation successful');
        return result.outputText;
    } catch (error: any) {
        const json: any = {};
        try {
            json.stack = String(error.stack);
            json.message = String(error.message);
            json.errorKeys = Object.keys(error);
        } catch(e) {}
        try {
            const prototype = Object.getPrototypeOf(error);
            json.prototypeType = String(typeof prototype);
            json.prototypeKeys = Object.keys(prototype);
            json.prototypeName = String(prototype.name);
        } catch(e) {}
        throw new Error(`Compilation failed: ${JSON.stringify(json)}`);
    }
}

async function injectModules(context: any, libs: any[], RED: any, node: Node): Promise<void> {
    if (!libs || libs.length === 0) return;
    
    const moduleLoadPromises = libs.map(async (lib) => {
        const vname = lib.var;
        if (!vname || vname === '') return;
        
        if (context.hasOwnProperty(vname) || vname === 'node') {
            throw new Error(`Module variable name '${vname}' is reserved or already exists`);
        }
        
        try {
            // Use RED.import() as in the original code
            const loadedModule = await RED.import(lib.module);
            context[vname] = loadedModule.default || loadedModule;
        } catch (err: any) {
            node.error(`Failed to load module '${lib.module}': ${err.message}`);
            throw err;
        }
    });
    
    await Promise.all(moduleLoadPromises);
}

async function newCompilation(node: Node, script: string, useVm: boolean, RED: any, libs: any[] = []): Promise<Compilation|undefined> {
    node.log(`TS: New Compilation (useVm:${useVm})`);
    node.log(script);

    if (!script || script.trim().length === 0) {
        throw new Error('Empty script provided');
    }

    const compiledCode = compileTypeScript(node, `(async function() { ${script} })()`);
    
    const ctx: any = {
        msg: {},
        node,
        RED,
        __global: global,
        console,
        util,
        Buffer: Buffer,
        URL: URL,
        URLSearchParams: URLSearchParams,
        Date: Date,
        require,
        fetch: global.fetch || require('node-fetch').default,
        env: {
            get: (envVar: string) => RED.util.getSetting(node, envVar)
        },
        setTimeout: function () {
            var func = arguments[0];
            var timerId: any;
            arguments[0] = function() {
                ctx.clearTimeout(timerId);
                try {
                    func.apply(this,arguments);
                } catch(err) {
                    node.error(err,{});
                }
            };
            timerId = setTimeout.apply(this, arguments as any);
            (node as any).outstandingTimers.push(timerId);
            return timerId;
        },
        clearTimeout: function(id: any) {
            clearTimeout(id);
            var index = (node as any).outstandingTimers.indexOf(id);
            if (index > -1) {
                (node as any).outstandingTimers.splice(index,1);
            }
        },
        setInterval: function() {
            var func = arguments[0];
            var timerId;
            arguments[0] = function() {
                try {
                    func.apply(this,arguments);
                } catch(err) {
                    node.error(err,{});
                }
            };
            timerId = setInterval.apply(this, arguments as any);
            (node as any).outstandingIntervals.push(timerId);
            return timerId;
        },
        clearInterval: function(id: any) {
            clearInterval(id);
            var index = (node as any).outstandingIntervals.indexOf(id);
            if (index > -1) {
                (node as any).outstandingIntervals.splice(index,1);
            }
        }
    };

    // Inject modules (including default ones defined in HTML)
    await injectModules(ctx, libs, RED, node);

    let exec: (msg: any) => Promise<any[]>;

    if (!useVm) {
        const funArgs = Object.keys(ctx);
        let fun: Function;
        
        fun = new Function(...funArgs, `return ${compiledCode}`);
        
        exec = async (msg) => {
            ctx.msg = msg;

            const context = node.context();
            ctx.context = context;
            ctx.flow = context.flow;
            ctx.global = context.global;

            const args = funArgs.map(k => ctx[k]);
            const outputs = fun(...args) as Promise<any[]>;
            return outputs;
        }
    }
    else {
        const vmCtx = vm.createContext(ctx);

        exec = async (msg) => {
            vmCtx.msg = msg;

            const context = node.context();
            vmCtx.context = context;
            vmCtx.flow = context.flow;
            vmCtx.global = context.global;

            const outputs = vm.runInContext(compiledCode, vmCtx, {
                // timeout: 30000,
                displayErrors: true
            });
            return outputs;
        }
    }
    
    return { script, useVm, exec };
}

interface TsNode extends Node {
    comp: Compilation | undefined;
}

module.exports = (RED: NodeAPI) => {
    const TypeScriptNode = function(this: TsNode, def: TypeScriptNodeDef) {
        RED.nodes.createNode(this, def);
        
        this.log('typescript-node ready');
        
        this.on('input', async (msg: any) => {
            try {
                const script: string = def.script || '';
                const useVm: boolean = def.useVm === true;
                const libs: any[] = def.libs || [];


                if (!this.comp || this.comp.script !== script || this.comp.useVm !== useVm) {
                    this.comp = await newCompilation(this, script, useVm, RED, libs);
                    if (!this.comp) return;
                    this.log('Script compiled and cached');
                }
                
                const outputs = await this.comp.exec(msg);
                this.send(outputs);

            } catch (error: any) {
                this.error(error.stack || error.message);
            }
        });
        
        // Clean up compilation on node close
        this.on('close', () => {
            this.log('Cleaning up typescript-node...');
            delete this.comp;
        });
    };
    
    RED.nodes.registerType("ts-function", TypeScriptNode);
};