# Node-RED TypeScript Node

A TypeScript execution node for Node-RED that provides a Monaco editor with full IntelliSense support.

## Installation

```bash
npm install node-red-contrib-typescript
```

## TypeScript Node

Execute TypeScript code directly in your Node-RED flows with full type checking and modern JavaScript features.

### Features

- **Monaco Editor** - Same editor as VS Code with syntax highlighting and IntelliSense
- **TypeScript Support** - Full TypeScript compilation with error checking
- **Async/Await Ready** - Your code runs in an async function context
- **Multiple Outputs** - Route messages to different outputs (1-10)
- **Two Execution Modes** - Function mode (fast) or VM mode (secure)

### Available Context

Your TypeScript code has access to these variables:

- `msg` - The incoming message object
- `node` - The current node instance for logging
- `RED` - Node-RED API
- `global` - Global context storage
- `env` - Environment variables via `env.get('VAR_NAME')`
- `fs`, `path`, `os`, `crypto`, `util`, `Buffer` - Node.js modules
- `fetch` - HTTP client for API calls
- `process` - Process information

### Basic Usage

**Simple data transformation:**
```typescript
// Transform the incoming payload
const data = msg.payload;
msg.payload = {
    processed: true,
    timestamp: new Date().toISOString(),
    originalData: data
};

return msg;
```

**API call with error handling:**
```typescript
try {
    const apiKey = env.get('API_KEY');
    const response = await fetch('https://api.example.com/data', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    
    msg.payload = await response.json();
    return msg;
} catch (error) {
    node.error(error.message);
    return null;
}
```

**Multiple outputs:**
```typescript
const data = msg.payload;

// Route to different outputs based on data type
if (data.type === 'error') {
    return [null, { ...msg, payload: data }]; // Send to second output
} else {
    return [{ ...msg, payload: data }, null]; // Send to first output
}
```

### Configuration

- **Script** - Your TypeScript code in the Monaco editor
- **Outputs** - Number of outputs (1-10)
- **Execution Mode** - Function mode (faster) or VM mode (more secure)

### Editor Features

- **IntelliSense** - Auto-completion for available context variables
- **Error Detection** - Real-time TypeScript error checking
- **Syntax Highlighting** - Full TypeScript syntax support
- **Template Code** - Helpful starter template for new nodes

## License

MIT