console.debug('[TS] v1.2.1');

declare const RED: any;
declare const window: typeof globalThis & {
    monaco: any;
    tsConfigured: any;
    currentNodeInstance: any;
};

function tr(key: string, params?: Record<string, string|number>) {
    var result = RED._("node-red:" + key);
    if (params) {
        for (var k in params) {
            result = result.replace('{' + k + '}', params[k]);
        }
    }
    return result;
}

function getLabel(this: any) {
    if (this.name) return this.name;
    
    let script = this.func || '';
    for (const [key, label] of Object.entries({
        'fetch(': '🌐 Fetch',
        'fs.': '📁 File',
        'crypto.': '🔐 Crypto',
        'setTimeout': '⏰ Timer',
        'setInterval': '🔄 Loop',
        'process.': '⚙️ Process',
        'JSON.': '📄 JSON',
        'Buffer': '🔢 Buffer'
    })) {
        if (script.includes(key)) return label;
    }

    // Extract keywords, limit to 20 chars
    const e = { const: 1, let: 1, var: 1, msg: 1, payload: 1, as: 1, any: 1, string: 1, number: 1, return: 1, null: 1 };
    let s = '';
    const ws = script.toLowerCase().match(/\w\w+/g) || [];
    for (let w of ws) {
        if (!e[w]) {
            e[w] = 1;
            const n = s ? s + ' ' + w : w;
            if (n.length <= 20) s = n;
            else break;
        }
    }
    if (s) return s;
    
    return "typescript";
}

function throwRequired(msg: string) {
    throw new Error(msg + ' is required');
}

function configMonaco(editor: any, customDeclare: any) {
    console.log('[TS] Config Monaco', editor);

    const monaco = window.monaco || throwRequired('monaco');
    const languages = monaco.languages || throwRequired('languages');
    const tsLanguage = languages.typescript || throwRequired('tsLanguage');
    const tsEditor = editor || throwRequired('tsEditor');
    const tsConfig = tsLanguage.typescriptDefaults || throwRequired('typescriptDefaults');
    
    // Get custom declarations or use default
    const declare = customDeclare || defaultDeclare;

    // Always update types to reflect current declarations
    console.log('[TS] Updating TypeScript types with declarations:', declare);

// declare const fs: typeof import('fs/promises');
// declare const path: typeof import('path');
// declare const os: typeof import('os');
// declare const crypto: typeof import('crypto');
// declare const util: typeof import('util');
// declare const process: typeof import('process');
// declare const Buffer: typeof globalThis.Buffer;
// declare const fetch: typeof globalThis.fetch;
// declare const require: typeof globalThis.require;
// req?: typeof import('express').Request;
// res?: typeof import('express').Response;

    // Add Node-RED global types
    const nodeRedTypes = `/// <reference lib="es2022" />
/// <reference types="node" />
declare const node: {
log: (message: string) => void;
warn: (message: string) => void;
error: (error: string | Error, message?: any) => void;
context: () => {
    get: (key: string, store?: string) => any;
    set: (key: string, value: any, store?: string) => void;
    flow: any;
    global: any;
};
send: (msg: any | any[]) => void;
id: string;
type: string;
name?: string;
};
declare const RED: {
util: {
    getSetting: (node: any, key: string) => any;
};
};
declare const context: {
get: (key: string, store?: string) => any;
set: (key: string, value: any, store?: string) => void;
flow: any;
global: any;
};
declare const flow: {
get: <T = any>(key: string) => T;
set: (key: string, value: any) => void;
};
declare const global: any;
declare const env: {
get: (key: string) => any;
};
interface MsgBase {
topic?: string;
payload: any;
[prop: string]: any;
}
${declare}
declare const msg: Msg;
`;
    
    // Update or add the extra lib
    tsConfig.addExtraLib(nodeRedTypes, 'file:///node-red-types.d.ts');

    // Only configure once per session
    if (!window.tsConfigured) {
        tsConfig.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            noSuggestionDiagnostics: false,
            diagnosticCodesToIgnore: [
                2451, // Cannot redeclare block-scoped variable 'msg'.
                1375, // 'await' expressions are only allowed at the top level of a file when that file is a module
                1378, // Top-level 'await' expressions are only allowed when the 'module' option is set to 'es2022'
                1108  // A 'return' statement can only be used within a function body
                // Removed 2339 to allow property errors to show
            ]
        });
        
        tsConfig.setCompilerOptions({
            target: tsLanguage.ScriptTarget.ES2022,
            module: tsLanguage.ModuleKind.NodeNext,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeNext,
            types: ['node'],
            allowJs: true,
            lib: ['ES2022'],
            skipLibCheck: false,
            noImplicitAny: true,
            strict: true,
            strictNullChecks: true,
            strictPropertyInitialization: true,
            noImplicitReturns: true,
            noImplicitThis: true
        });
        
        console.log('[TS] TypeScript configured globally');
        window.tsConfigured = true;
    }

    // Configure individual editor model
    const tsModel = tsEditor.getModel();
    if (tsModel) {
        console.log('[TS] Current model URI:', tsModel.uri.path, 'Language:', tsModel.getLanguageId());
        
        if (!tsModel.uri.path.endsWith('.ts') || tsModel.getLanguageId() !== 'typescript') {
            console.log('[TS] Converting model to TypeScript');
            
            // Generate unique URI for this editor
            const uniqueId = tsEditor.getId ? tsEditor.getId() : Math.random().toString(36).substr(2, 9);
            const tsUri = monaco.Uri.parse(`file:///ts-${uniqueId}.ts`);
            
            // Check if model already exists with this URI
            let existingModel = monaco.editor.getModel(tsUri);
            if (existingModel) {
                console.log('[TS] Using existing TypeScript model');
                tsEditor.setModel(existingModel);
            } else {
                console.log('[TS] Creating new TypeScript model');
                const newModel = monaco.editor.createModel(
                    tsModel.getValue(),
                    'typescript',
                    tsUri
                );
                tsEditor.setModel(newModel);
            }
        } else {
            console.log('[TS] Model is already TypeScript');
            // Force language to typescript if not already set
            if (tsModel.getLanguageId() !== 'typescript') {
                monaco.editor.setModelLanguage(tsModel, 'typescript');
                console.log('[TS] Language set to TypeScript');
            }
        }
    }
}

function configEditor(options: any, that: any) {
    options.mode = "ace/mode/typescript";
    options.language = "typescript";

    const extraLibs = options.extraLibs || [];
    console.debug('extraLibs', extraLibs, that, options);
    
    
    return options;
}

function setEditor(editor: any) {

    if (editor.type === "monaco") {
        // Configure Monaco TypeScript editor
        // Wait for editor to be ready, then configure
        setTimeout(() => {
            try {
                // Get current declarations from the editor (need to find the node instance)
                let customDeclare = null;
                if (window.currentNodeInstance && window.currentNodeInstance.declareEditor) {
                    customDeclare = window.currentNodeInstance.declareEditor.getValue();
                }
                configMonaco(editor, customDeclare);
                
                // Verify TypeScript is working after configuration
                setTimeout(() => {
                    const model = editor.getModel();
                    if (model) {
                        console.log('[TS] Final verification - Language:', model.getLanguageId(), 'URI:', model.uri.path);
                        
                        // Force a diagnostic check by adding some temporary content
                        const originalValue = model.getValue();
                        model.setValue(originalValue + '\n// TypeScript check');
                        setTimeout(() => {
                            model.setValue(originalValue);
                        }, 100);
                    }
                }, 500);
            }
            catch (error) {
                console.error('[TS] Config Monaco Error', error);
            }
        }, 100);
    } else {
        console.log('[TS] Editor not ready for Monaco configuration yet');
        // Editor might not be fully initialized during expansion
        if (editor && typeof editor.getModel === 'function') {
            const model = editor.getModel();
            if (model && model.getLanguageId() !== 'typescript') {
                window.monaco.editor.setModelLanguage(model, 'typescript');
            }
        }
    }
    
    console.log('[TS] TypeScript editor configuration completed');
    
    // Configure completion for available globals
    if (editor.completers) {
        editor.completers.push({
            getCompletions: function(editor, session, pos, prefix, callback) {
                var completions = [
                    // Node-RED context
                    {name: "msg", value: "msg", score: 1000, meta: "node-red"},
                    {name: "node", value: "node", score: 1000, meta: "node-red"},
                    {name: "RED", value: "RED", score: 1000, meta: "node-red"},
                    {name: "global", value: "global", score: 1000, meta: "node-red"},
                    {name: "env", value: "env", score: 1000, meta: "node-red"},
                    
                    // Node.js modules
                    {name: "fs", value: "fs", score: 900, meta: "nodejs"},
                    {name: "path", value: "path", score: 900, meta: "nodejs"},
                    {name: "os", value: "os", score: 900, meta: "nodejs"},
                    {name: "crypto", value: "crypto", score: 900, meta: "nodejs"},
                    {name: "util", value: "util", score: 900, meta: "nodejs"},
                    {name: "Buffer", value: "Buffer", score: 900, meta: "nodejs"},
                    {name: "fetch", value: "fetch", score: 900, meta: "nodejs"},
                    
                    // Keywords
                    {name: "return", value: "return ", score: 800, meta: "keyword"},
                    {name: "await", value: "await ", score: 800, meta: "keyword"},
                    {name: "async", value: "async ", score: 800, meta: "keyword"}
                ];
                callback(null, completions);
            }
        });
    }
}

function resetDeclare(that: any) {
    console.log('[TS] Reset declare', that);
    that.declareEditor.setValue(defaultDeclare);
}

var invalidModuleVNames = [
    'console',
    'util',
    'Buffer',
    'Date',
    'RED',
    'node',
    '__node__',
    'context',
    'flow',
    'global',
    'env',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'promisify'
]

var knownFunctionNodes = {};
RED.events.on("nodes:add", function(n) {
    if (n.type === "typescript") {
        knownFunctionNodes[n.id] = n;
    }
})
RED.events.on("nodes:remove", function(n) {
    if (n.type === "typescript") {
        delete knownFunctionNodes[n.id];
    }
})

var missingModules = [];
var missingModuleReasons = {};
RED.events.on("runtime-state", function(event) {
    if (event.error === "missing-modules") {
        missingModules = event.modules.map(function(m) { missingModuleReasons[m.module] = m.error; return m.module });
        for (var id in knownFunctionNodes) {
            if (knownFunctionNodes.hasOwnProperty(id) && knownFunctionNodes[id].libs && knownFunctionNodes[id].libs.length > 0) {
                RED.editor.validateNode(knownFunctionNodes[id])
            }
        }
    } else if (!event.text) {
        missingModuleReasons = {};
        missingModules = [];
        for (var id in knownFunctionNodes) {
            if (knownFunctionNodes.hasOwnProperty(id) && knownFunctionNodes[id].libs && knownFunctionNodes[id].libs.length > 0) {
                RED.editor.validateNode(knownFunctionNodes[id])
            }
        }
    }
    RED.view.redraw();
});

var installAllowList = ['*'];
var installDenyList = [];

var modulesEnabled = true;
if (RED.settings.get('externalModules.modules.allowInstall', true) === false) {
    modulesEnabled = false;
}
var settingsAllowList = RED.settings.get("externalModules.modules.allowList")
var settingsDenyList = RED.settings.get("externalModules.modules.denyList")
if (settingsAllowList || settingsDenyList) {
    installAllowList = settingsAllowList;
    installDenyList = settingsDenyList
}
installAllowList = RED.utils.parseModuleList(installAllowList);
installDenyList = RED.utils.parseModuleList(installDenyList);


// object that maps from library name to its descriptor
var allLibs = [];

function getAllUsedModules() {
    var moduleSet = new Set();
    for (var id in knownFunctionNodes) {
        if (knownFunctionNodes.hasOwnProperty(id)) {
            if (knownFunctionNodes[id].libs) {
                for (var i=0, l=knownFunctionNodes[id].libs.length; i<l; i++) {
                    if (RED.utils.checkModuleAllowed(knownFunctionNodes[id].libs[i].module,null,installAllowList,installDenyList)) {
                        moduleSet.add(knownFunctionNodes[id].libs[i].module);
                    }
                }
            }
        }
    }
    var modules = Array.from(moduleSet);
    modules.sort();
    return modules;
}

function prepareLibraryConfig(node: any) {
    $(".node-input-libs-row").show();
    var usedModules = getAllUsedModules();
    var typedModules = usedModules.map(function(l) {
        return {
            icon:"fa fa-cube",
            value:l,
            label:l,
            hasValue:false
        }
    })
    typedModules.push({
        value: "_custom_",
        label: RED._("editor:subflow.licenseOther"),
        icon: "red/images/typedInput/az.svg",
        hasValue: false
    })

    var libList = $("#node-input-libs-container").css('min-height','100px').css('min-width','450px').editableList({
        header: $('<div><div data-i18n="node-red:function.require.moduleName"></div><div data-i18n="node-red:function.require.importAs"></div></div>'),
        addItem: function(container: any, i: any, opt: any) {
            var parent = container.parent();
            var row0 = $("<div/>").addClass("node-libs-entry").appendTo(container);
            var fmoduleSpan = $("<span>").appendTo(row0);
            var fmodule = $("<input/>", {
                class: "node-input-libs-val",
                placeholder: tr("function.require.module"),
                type: "text"
            }).css({
            }).appendTo(fmoduleSpan).typedInput({
                types: typedModules as any,
                default: usedModules.indexOf(opt.module) > -1 ? opt.module : "_custom_"
            }) as any;
            if (usedModules.indexOf(opt.module) === -1) {
                fmodule.typedInput('value', opt.module);
            }
            var moduleWarning = $('<span style="position: absolute;right:2px;top:7px; display:inline-block; width: 16px;"><i class="fa fa-warning"></i></span>').appendTo(fmoduleSpan);
            RED.popover.tooltip(moduleWarning.find("i"), function() {
                var val = fmodule.typedInput("type");
                if (val === "_custom_") {
                    val = fmodule.val();
                }
                var errors = [];

                if (!RED.utils.checkModuleAllowed(val,null,installAllowList,installDenyList)) {
                    return tr("function.error.moduleNotAllowed", {module: val});
                } else {
                    return tr("function.error.moduleLoadError", {module: val, error: missingModuleReasons[val]});
                }
            })

            var fvarSpan = $("<span>").appendTo(row0);

            var fvar = $("<input/>", {
                class: "node-input-libs-var red-ui-font-code",
                placeholder: tr("function.require.var"),
                type: "text"
            }).css({
            }).appendTo(fvarSpan).val(opt.var) as any;
            var vnameWarning = $('<span style="position: absolute; right:2px;top:7px;display:inline-block; width: 16px;"><i class="fa fa-warning"></i></span>').appendTo(fvarSpan);
            RED.popover.tooltip(vnameWarning.find("i"), function() {
                var val = fvar.val() as string;
                if (invalidModuleVNames.indexOf(val) !== -1) {
                    return tr("function.error.moduleNameReserved", {name: val})
                } else {
                    return tr("function.error.moduleNameError", {name: val})
                }
            })



            fvar.on("change keyup paste", function (this: any, e: any) {
                var v = ($(this).val() as string || '').trim();
                if (v === "" || / /.test(v) || invalidModuleVNames.indexOf(v) !== -1) {
                    fvar.addClass("input-error");
                    vnameWarning.addClass("input-error");
                } else {
                    fvar.removeClass("input-error");
                    vnameWarning.removeClass("input-error");
                }
            });

            fmodule.on("change keyup paste", function (this: any, e: any) {
                var val = $(this).typedInput("type");
                if (val === "_custom_") {
                    val = $(this).val();
                }
                var varName = (val as string).trim().replace(/^node:/,"").replace(/^@/,"").replace(/@.*$/,"").replace(/[-_/\.].?/g, function(v) { return v[1]?v[1].toUpperCase():"" });
                fvar.val(varName);
                fvar.trigger("change");

                if (RED.utils.checkModuleAllowed(val as string,null,installAllowList as any,installDenyList as any) && ((missingModules as any).indexOf(val as string) === -1)) {
                    fmodule.removeClass("input-error");
                    moduleWarning.removeClass("input-error");
                } else {
                    fmodule.addClass("input-error");
                    moduleWarning.addClass("input-error");
                }
            });
            if (RED.utils.checkModuleAllowed(opt.module as string,null,installAllowList as any,installDenyList as any) && ((missingModules as any).indexOf(opt.module as string) === -1)) {
                fmodule.removeClass("input-error");
                moduleWarning.removeClass("input-error");
            } else {
                fmodule.addClass("input-error");
                moduleWarning.addClass("input-error");
            }
            if (opt.var) {
                fvar.trigger("change");
            }
        },
        removable: true
    });

    var libs = node.libs || [];
    for (var i=0,l=libs.length;i<l; i++) {
        libList.editableList('addItem',libs[i])
    }

}

function getLibsList() {
    var _libs = [];
    if (RED.settings.functionExternalModules !== false) {
        var libs = $("#node-input-libs-container").editableList("items");
        libs.each(function(i) {
            var item = $(this);
            var v = item.find(".node-input-libs-var").val() as string;
            var n = item.find(".node-input-libs-val").typedInput("type");
            if (n === "_custom_") {
                n = item.find(".node-input-libs-val").val() as string;
            }
            if ((!v || (v === "")) ||
                (!n || (n === ""))) {
                return;
            }
            (_libs as any).push({
                var: v,
                module: n as string
            });
        });
    }
    return _libs;
}

const defaultDeclare = "interface Msg extends MsgBase {}";

RED.nodes.registerType('typescript',{
    color: "#61adff",
    category: 'function',
    paletteLabel: 'typescript',
    defaults: {
        name: {value:"_DEFAULT_"},
        func: {value:"\nreturn msg;"},
        outputs: {value:1},
        timeout:{value:RED.settings.functionTimeout || 0},
        useVm: {value:false},
        updated: {value:0},
        declare: {value:""},
        noerr: {value:0,required:true,
                validate: function(v: any, opt: any) {
                    if (!v) {
                        return true;
                    }
                    return tr("function.error.invalid-js");
                }},
        initialize: {value:""},
        finalize: {value:""},
        libs: {value: [], validate: function(v: any, opt: any) {
            if (!v) { return true; }
            for (var i=0,l=v.length;i<l;i++) {
                var m = v[i];
                if (!RED.utils.checkModuleAllowed(m.module,null,installAllowList,installDenyList)) {
                    return tr("function.error.moduleNotAllowed", {module: m.module});
                }
                if (m.var === "" || / /.test(m.var)) {
                    return tr("function.error.moduleNameError", {name: m.var});
                }
                if ((missingModules as any).indexOf(m.module as string) > -1) {
                    return tr("function.error.missing-module", {module: m.module});
                }
                if (invalidModuleVNames.indexOf(m.var) !== -1){
                    return tr("function.error.moduleNameError", {name: m.var});
                }
            }
            return true;
        }}
    },
    inputs:1,
    outputs:1,
    icon: "typescript.svg",
    label: getLabel,
    labelStyle: function(this: any) {
        return this.name?"node_label_italic":"";
    },
    oneditprepare: function(this: any) {
        var that = this;
        window.currentNodeInstance = this;

        var tabs = RED.tabs.create({
            id: "func-tabs",
            onchange: function(tab: any) {
                $("#func-tabs-content").children().hide();
                $("#" + tab.id).show();
                let editor = $("#" + tab.id).find('.monaco-editor').first();
                if(editor.length) {
                    if(that.editor.nodered && that.editor.type == "monaco") {
                        that.editor.nodered.refreshModuleLibs(getLibsList());
                    }
                    RED.tray.resize();
                    //auto focus editor on tab switch
                    if (that.initEditor.getDomNode() == editor[0]) {
                        that.initEditor.focus();
                    } else if (that.editor.getDomNode() == editor[0]) {
                        that.editor.focus();
                    } else if (that.finalizeEditor.getDomNode() == editor[0]) {
                        that.finalizeEditor.focus();
                    }
                }
            }
        });
        tabs.addTab({
            id: "func-tab-config",
            iconClass: "fa fa-cog",
            label: tr("function.label.setup")
        });

        tabs.addTab({
            id: "func-tab-init",
            label: tr("function.label.initialize")
        });
        tabs.addTab({
            id: "func-tab-body",
            label: tr("function.label.function")
        });
        tabs.addTab({
            id: "func-tab-finalize",
            label: tr("function.label.finalize")
        });

        tabs.activateTab("func-tab-body");

        ($( "#node-input-outputs" ) as any).spinner({
            min: 0,
            max: 500,
            change: function(this: any, event: any, ui: any) {
                var value = parseInt(this.value);
                value = isNaN(value) ? 1 : value;
                value = Math.max(value, parseInt($(this).attr("aria-valuemin") || '0'));
                value = Math.min(value, parseInt($(this).attr("aria-valuemax") || '500'));
                if (value !== this.value) { ($(this) as any).spinner("value", value); }
            }
        });

        // 4294967 is max in node.js timeout.
        ($( "#node-input-timeout" ) as any).spinner({
            min: 0,
            max: 4294967,
            change: function(this: any, event: any, ui: any) {
                var value = this.value;
                if(value == ""){
                    value = 0;
                }
                else
                {
                    value = parseInt(value);
                }
                value = isNaN(value) ? 1 : value;
                value = Math.max(value, parseInt($(this).attr("aria-valuemin") || '0'));
                value = Math.min(value, parseInt($(this).attr("aria-valuemax") || '4294967'));
                if (value !== this.value) { ($(this) as any).spinner("value", value); }
            }
        });

        var buildEditor = function(id: any, stateId: any, focus: any, value: any, defaultValue: any, extraLibs: any, offset: any) {
            var editor = RED.editor.createEditor(configEditor({
                id: id,
                mode: 'ace/mode/nrjavascript',
                value: value || defaultValue || "",
                stateId: stateId,
                focus: true,
                globals: {
                    msg:true,
                    context:true,
                    RED: true,
                    util: true,
                    flow: true,
                    global: true,
                    console: true,
                    Buffer: true,
                    setTimeout: true,
                    clearTimeout: true,
                    setInterval: true,
                    clearInterval: true
                },
                extraLibs: extraLibs
            }, that));
            if (defaultValue && value === "") {
                editor.moveCursorTo(defaultValue.split("\n").length +offset, 0);
            }
            editor.__stateId = stateId;
            setEditor(editor);
            return editor;
        }
        this.initEditor = buildEditor('node-input-init-editor', this.id + "/" + "initEditor", false, $("#node-input-initialize").val(), tr("function.text.initialize"), undefined, 0);
        this.editor = buildEditor('node-input-func-editor', this.id + "/" + "editor", true, $("#node-input-func").val(), undefined, that.libs || [], -1);
        this.finalizeEditor = buildEditor('node-input-finalize-editor', this.id + "/" + "finalizeEditor", false, $("#node-input-finalize").val(), tr("function.text.finalize"), undefined, 0);
        this.declareEditor = buildEditor('node-input-declare-editor', this.id + "/" + "declareEditor", false, this.declare, undefined, undefined, 0);

        RED.library.create({
            url:"functions", // where to get the data from
            type:"function", // the type of object the library is for
            editor:this.editor, // the field name the main text body goes to
            mode:"ace/mode/nrjavascript",
            fields:[
                'name', 'outputs', 'timeout',
                {
                    name: 'initialize',
                    get: function() {
                        return that.initEditor.getValue();
                    },
                    set: function(v) {
                        that.initEditor.setValue(v||tr("function.text.initialize"), -1);
                    }
                },
                {
                    name: 'finalize',
                    get: function() {
                        return that.finalizeEditor.getValue();
                    },
                    set: function(v) {
                        that.finalizeEditor.setValue(v||tr("function.text.finalize"), -1);
                    }
                },
                {
                    name: 'info',
                    get: function() {
                        return that.infoEditor.getValue();
                    },
                    set: function(v) {
                        that.infoEditor.setValue(v||"", -1);
                    }
                }
            ],
            ext:"js"
        });

        var expandButtonClickHandler = function(editor) {
            return function (e) {
                e.preventDefault();
                var value = editor.getValue();
                editor.saveView(`inside function-expandButtonClickHandler ${editor.__stateId}`);
                var extraLibs = that.libs || [];
                RED.editor.editJavaScript(configEditor({
                    value: value,
                    width: "Infinity",
                    stateId: editor.__stateId,
                    mode: "ace/mode/nrjavascript",
                    focus: true,
                    cancel: function () {
                        setTimeout(function () {
                            editor.focus();
                        }, 250);
                    },
                    complete: function (v, cursor) {
                        editor.setValue(v, -1);
                        setTimeout(function () {
                            editor.restoreView();
                            editor.focus();
                        }, 250);
                    },
                    onready: function(expandedEditor) {
                        // Configure the expanded editor with TypeScript
                        console.log('[TS] Expanded editor ready, configuring TypeScript');
                        setEditor(expandedEditor);
                    },
                    extraLibs: extraLibs
                }, that));
            }
        }
        $("#node-init-expand-js").on("click", expandButtonClickHandler(this.initEditor));
        $("#node-function-expand-js").on("click", expandButtonClickHandler(this.editor));
        $("#node-finalize-expand-js").on("click", expandButtonClickHandler(this.finalizeEditor));
        $("#node-declare-expand-js").on("click", expandButtonClickHandler(this.declareEditor));

        RED.popover.tooltip($("#node-init-expand-js"), tr("common.label.expand"));
        RED.popover.tooltip($("#node-function-expand-js"), tr("common.label.expand"));
        RED.popover.tooltip($("#node-finalize-expand-js"), tr("common.label.expand"));
        RED.popover.tooltip($("#node-declare-expand-js"), tr("common.label.expand"));
        RED.popover.tooltip($("#node-reset-declare"), "Reset declare types");
        
        // Auto-detect button handler
        $("#node-reset-declare").on("click", function() {
            resetDeclare(that);
        });

        if (RED.settings.functionExternalModules !== false) {
            prepareLibraryConfig(that);
            
            // Update TypeScript types when declarations change
            if (this.declareEditor) {
                this.declareEditor.on('change', function() {
                    const newDeclare = that.declareEditor.getValue();
                    // Update all Monaco editors with new declarations
                    [that.editor, that.initEditor, that.finalizeEditor].forEach(function(editor) {
                        if (editor && editor.type === "monaco") {
                            try {
                                configMonaco(editor, newDeclare);
                            } catch (error) {
                                console.warn('[TS] Failed to update declarations:', error);
                            }
                        }
                    });
                });
            }
            
            // Add default modules button logic
            $("#node-add-default-modules").on("click", function() {
                var defaultModules = [
                    { var: 'fs', module: 'fs/promises' },
                    { var: 'path', module: 'path' },
                    { var: 'os', module: 'os' },
                    { var: 'crypto', module: 'crypto' },
                    { var: 'process', module: 'process' },
                    { var: 'stream', module: 'stream' },
                    { var: 'events', module: 'events' },
                    { var: 'zlib', module: 'zlib' },
                    { var: 'child_process', module: 'child_process' }
                ];
                
                var libList = $("#node-input-libs-container");
                defaultModules.forEach(function(module) {
                    libList.editableList('addItem', module);
                });
            });
        }
    },
    oneditsave: function(this: any) {
        var node = this;
        var noerr = 0;
        $("#node-input-noerr").val(0);
        
        // Transfer old script property to func for backward compatibility
        if (this.script && !this.func) {
            this.func = this.script;
            delete this.script;
        }
        
        // Update timestamp to invalidate compilation cache
        $("#node-input-updated").val(Date.now());

        var disposeEditor = function(editorName: string, targetName: string, defaultValue?: string) {
            var editor = node[editorName];
            var annot = editor.getSession().getAnnotations();
            for (var k=0; k < annot.length; k++) {
                if (annot[k].type === "error") {
                    noerr += annot.length;
                    break;
                }
            }
            var val = editor.getValue();
            if (defaultValue) {
                if (val.trim() == defaultValue.trim()) {
                    val = "";
                }
            }
            editor.destroy();
            delete node[editorName];
            $("#"+targetName).val(val);
        }
        disposeEditor("editor","node-input-func");
        disposeEditor("initEditor","node-input-initialize", tr("function.text.initialize"));
        disposeEditor("finalizeEditor","node-input-finalize", tr("function.text.finalize"));
        disposeEditor("declareEditor","node-input-declare");

        $("#node-input-noerr").val(noerr);
        this.noerr = noerr;
        node.libs = getLibsList();
    },
    oneditcancel: function(this: any) {
        var node = this;

        node.editor.destroy();
        delete node.editor;

        node.initEditor.destroy();
        delete node.initEditor;

        node.finalizeEditor.destroy();
        delete node.finalizeEditor;

        node.declareEditor.destroy();
        delete node.declareEditor;
    },
    oneditresize: function(this: any, size: any) {
        var rows = $("#dialog-form>div:not(.node-text-editor-row)");
        var height = $("#dialog-form").height() || 0;
        for (var i=0; i<rows.length; i++) {
            height -= ($(rows[i]).outerHeight(true) || 0);
        }
        var editorRow = $("#dialog-form>div.node-text-editor-row");
        height -= (parseInt(editorRow.css("marginTop") || '0')+parseInt(editorRow.css("marginBottom") || '0'));
        $("#dialog-form .node-text-editor").css("height",height+"px");

        var sizeHeight = size.height || 0;
        $("#node-input-init-editor").css("height", (sizeHeight - 75)+"px");
        $("#node-input-func-editor").css("height", (sizeHeight - 75)+"px");
        $("#node-input-finalize-editor").css("height", (sizeHeight - 75)+"px");

        this.initEditor.resize();
        this.editor.resize();
        this.finalizeEditor.resize();
        
        if (this.declareEditor) {
            this.declareEditor.resize();
        }

        $("#node-input-libs-container").css("height", (sizeHeight - 330)+"px");
    },
    onadd: function(this: any) {
        if (this.name === '_DEFAULT_') {
            this.name = '';
            RED.actions.invoke("core:generate-node-names", this, {generateHistory: false})
        }
    }
});