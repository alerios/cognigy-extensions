# Cognigy Extension Development Guide

## Summary of Findings from CXone SmartReach Extension Development

This document captures key learnings and best practices discovered while building the CXone SmartReach extension for Cognigy.AI.

---

## 1. Package Configuration (`package.json`)

### Required Format

```json
{
  "name": "extension-name",  // Simple name, NO @scope/package format
  "version": "1.0.0",
  "description": "Clear description of extension functionality",
  "main": "build/module.js",
  "author": "Name <email@domain.com> (Organization)",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/Cognigy/Extensions"
  },
  "keywords": ["relevant", "search", "terms"],
  "scripts": {
    "transpile": "tsc",
    "lint": "tslint -c tslint.json 'src/**/*.ts'",
    "zip": "tar cfz extension-name.tar.gz build/* package.json package-lock.json README.md icon.png",
    "build": "npm run transpile && npm run lint && npm run zip"
  },
  "dependencies": {
    "@cognigy/extension-tools": "^0.16.6"  // Use latest stable version
  },
  "devDependencies": {
    "@types/node": "^13.13.52",
    "tslint": "^6.1.3",
    "typescript": "^5.9.2"
  }
}
```

### Critical Rules

1. **Package Name**: Must follow `resource-name` format (lowercase, hyphens allowed, NO scoped packages like `@cognigy/extension-name`)
2. **Author Field**: Can include name, email, and organization: `"Name <email> (Organization)"`
3. **Zip Script**: Must include `build/*`, `package.json`, `package-lock.json`, `README.md`, and `icon.png`
4. **Extension Tools Version**: Use latest (currently 0.16.6) for best compatibility

---

## 2. TypeScript Configuration (`tsconfig.json`)

### Recommended Configuration

```json
{
  "compileOnSave": true,
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "module": "commonjs",
    "target": "es2017",
    "rootDir": "src",
    "outDir": "build",
    "sourceMap": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "noImplicitReturns": true,
    "alwaysStrict": true,
    "declaration": true,
    "typeRoots": ["./node_modules/@types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "./vscode"]
}
```

### Key Points

- **DO NOT** include `"watch": false` in config file (command-line only option)
- Use `"skipLibCheck": true` to avoid node_modules type conflicts
- Include `"sourceMap": true` for debugging support
- Set `"rootDir": "src"` and `"outDir": "build"` explicitly

---

## 3. TSLint Configuration (`tslint.json`)

### Recommended Configuration

```json
{
  "rules": {
    "prefer-for-of": true,
    "only-arrow-functions": [true, "allow-declarations", "allow-named-functions"],
    "no-var-keyword": true,
    "no-var-requires": false,
    "comment-format": [true, "check-space"],
    "no-duplicate-variable": true,
    "no-eval": false,
    "no-internal-module": true,
    "no-trailing-whitespace": true,
    "no-string-literal": false,
    "one-line": [true, "check-open-brace", "check-whitespace", "check-catch", "check-finally", "check-else"],
    "semicolon": [true, "always"],
    "triple-equals": [true, "allow-null-check"],
    "typedef-whitespace": [true, {
      "call-signature": "nospace",
      "index-signature": "nospace",
      "parameter": "nospace",
      "property-declaration": "nospace",
      "variable-declaration": "nospace"
    }],
    "typedef": [true, "call-signature", "parameter", "member-variable-declaration"],
    "variable-name": [true, "ban-keywords"],
    "whitespace": [true, "check-branch", "check-decl", "check-operator", "check-separator", "check-type"]
  }
}
```

### Important Note

- **DO NOT** extend `"tslint:recommended"` - it includes overly strict rules like `no-string-literal` that break SIP header parsing
- Set `"no-string-literal": false` explicitly to allow bracket notation for hyphenated property names

---

## 4. Module Configuration (`src/module.ts`)

### Structure

```typescript
import { createExtension } from "@cognigy/extension-tools";
import { myConnection } from "./connections/myConnection";
import { node1, onSuccess1, onError1 } from "./nodes/node1";
import { node2 } from "./nodes/node2";

export default createExtension({
  nodes: [
    node1,
    onSuccess1,  // Child nodes must be exported
    onError1,
    node2
  ],
  connections: [
    myConnection
  ],
  options: {
    label: "Extension Display Name"  // NO parentheses or special characters
  }
});
```

### Critical Rules

1. **Label Format**: Simple text only, NO parentheses like `"Name (Details)"` - use `"Name Details"` instead
2. **Child Nodes**: Must be explicitly included in nodes array
3. **Unique Types**: Every node must have a globally unique `type` property

---

## 5. Connection Schema

### Pattern

```typescript
import { IConnectionSchema } from "@cognigy/extension-tools";

export const myConnection: IConnectionSchema = {
  type: "unique-connection-type",  // Must be unique across all extensions
  label: "Connection Display Name",
  fields: [
    { fieldName: "apiKey" },
    { fieldName: "baseUrl" },
    { fieldName: "clientId" }
  ]
};
```

### Important Notes

- Connection fields in v0.14.0+ do NOT support `label`, `type`, or `placeholder` properties
- Keep it simple: just `fieldName` for each field
- Connection type should be unique and descriptive

---

## 6. Node Descriptors

### Main Node Pattern

```typescript
import { createNodeDescriptor, INodeFunctionBaseParams } from "@cognigy/extension-tools";

export const myNode = createNodeDescriptor({
  type: "uniqueNodeType",  // MUST BE GLOBALLY UNIQUE
  defaultLabel: "Node Display Name",
  summary: "Brief description of what this node does",
  fields: [
    {
      key: "connection",
      label: "Connection",
      type: "connection",
      params: {
        connectionType: "unique-connection-type",
        required: true
      }
    },
    {
      key: "inputField",
      label: "Input Label",
      type: "cognigyText",
      defaultValue: "",
      params: {
        required: false
      }
    }
  ],
  sections: [
    {
      key: "storage",
      label: "Storage Options",
      defaultCollapsed: true,
      fields: ["storeLocation", "contextKey"]
    }
  ],
  form: [
    { type: "field", key: "connection" },
    { type: "section", key: "storage" }
  ],
  appearance: {
    color: "#0077C8"
  },
  dependencies: {
    children: ["onSuccess", "onError"]  // If node has child nodes
  },
  function: async ({ cognigy, config }: INodeFunctionBaseParams) => {
    const api = cognigy.api as any;
    const { connection, inputField } = config as any;
    
    try {
      // Node logic here
      api.output("Success message", {});
    } catch (error) {
      api.log("error", error.message);
    }
  }
});
```

### Child Node Pattern

```typescript
export const onSuccess = createNodeDescriptor({
  type: "onSuccessUniqueName",  // MUST BE UNIQUE - append parent name
  parentType: "uniqueNodeType",
  defaultLabel: "On Success",
  appearance: {
    color: "#61d188",
    textColor: "white",
    variant: "mini"
  },
  constraints: {
    editable: false,
    deletable: true,  // Allow deletion
    collapsable: true,  // Allow collapsing
    creatable: true,  // Allow creation (users can add more)
    movable: false,  // Cannot reorder
    placement: {
      predecessor: {
        whitelist: []
      }
    }
  }
});

export const onError = createNodeDescriptor({
  type: "onErrorUniqueName",  // MUST BE UNIQUE - append parent name
  parentType: "uniqueNodeType",
  defaultLabel: "On Error",
  appearance: {
    color: "#cf142b",
    textColor: "white",
    variant: "mini"
  },
  constraints: {
    editable: false,
    deletable: true,  // Allow deletion
    collapsable: true,  // Allow collapsing
    creatable: true,  // Allow creation (users can add more)
    movable: false,  // Cannot reorder
    placement: {
      predecessor: {
        whitelist: []
      }
    }
  }
    textColor: "white",
    variant: "mini"
  }
});
```

### CRITICAL: Unique Node Types and Dependencies

**PROBLEM**: Cannot have duplicate node types across the extension, and dependencies array references must match child node types exactly
**SOLUTION**: 
1. Make child node types unique by appending parent identifier
2. Reference unique type names in dependencies array
3. Use `childConfigs` parameter in function to locate child nodes

❌ **WRONG** (causes DB error):
```typescript
// In node1.ts
export const onSuccess = createNodeDescriptor({ 
  type: "onSuccess",
  parentType: "node1"
});
export const onError = createNodeDescriptor({ 
  type: "onError",
  parentType: "node1"
});

// In node2.ts - DUPLICATE TYPES!
export const onSuccess = createNodeDescriptor({ 
  type: "onSuccess",  // ❌ DUPLICATE
  parentType: "node2"
});

// Missing dependencies or wrong names
export const node1 = createNodeDescriptor({
  type: "node1",
  dependencies: {
    children: ["onSuccess", "onError"]  // ❌ Not specific enough
  }
});
```

✅ **CORRECT**:
```typescript
// In init-context.ts
export const onSuccess = createNodeDescriptor({ 
  type: "onSuccessInit",  // ✅ Unique
  parentType: "initSmartReachContext"
});
export const onError = createNodeDescriptor({ 
  type: "onErrorInit",  // ✅ Unique
  parentType: "initSmartReachContext"
});

// In save-termcode.ts  
export const onSuccess = createNodeDescriptor({ 
  type: "onSuccessSave",  // ✅ Unique (different from onSuccessInit)
  parentType: "saveTermCode"
});

// Parent node with correct dependencies
export const initSmartReachContext = createNodeDescriptor({
  type: "initSmartReachContext",
  dependencies: {
    children: [
      "onSuccessInit",  // ✅ Exact match with child type
      "onErrorInit"     // ✅ Exact match with child type
    ]
  },
  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    // Access child nodes by exact type
    const successChild = childConfigs.find(child => child.type === "onSuccessInit");
    const errorChild = childConfigs.find(child => child.type === "onErrorInit");
    
    if (successChild) {
      api.setNextNode(successChild.id);
    }
  }
});
```

### Child Node Constraints - Correct Pattern

Based on Cognigy example (docs/example/randomPath.ts), use:

```typescript
constraints: {
  editable: false,       // Cannot edit child node directly
  deletable: true,       // CAN delete child nodes
  collapsable: true,     // CAN collapse child nodes  
  creatable: true,       // CAN create multiple instances
  movable: false,        // Cannot move child nodes
  placement: {
    predecessor: {
      whitelist: []      // No specific predecessor requirements
    }
  }
}
```

---

## 7. Type Safety Workarounds

### Issue with Strict Types

The extension-tools types can be overly strict. Use type assertions:

```typescript
function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
  const api = cognigy.api as any;  // Bypass strict typing
  const { field1, field2 } = config as any;  // Access config freely
  
  // Access input data
  const sipHeaders = api.input?.data?._sipHeaders || {};
  
  // API methods
  api.output("text", data);
  
  // Use childConfigs to navigate to child nodes
  const child = childConfigs.find(c => c.type === "myChildType");
  if (child) {
    api.setNextNode(child.id);
  }
```
  api.log("info", "message");
  api.setNextNode("nodeId");
}
```

---

## 8. Common Errors and Solutions

### Error: "Field 'properties.name' should be of format 'resource-name'"

**Cause**: Package name uses scoped format like `@cognigy/extension-name`

**Solution**: Use simple name format: `"name": "extension-name"`

---

### Error: "Failed to create new extension. Db error occurred."

**Possible Causes**:

1. **Duplicate node types** - Most common cause
   - Check all node `type` properties are unique
   - Child nodes (onSuccess, onError) from different parents need unique types

2. **Invalid label format** - Parentheses in module label
   - Change `"label": "Name (Details)"` to `"label": "Name Details"`

3. **Invalid connection type** - Conflicting with existing extension

---

### Error: "Option 'watch' can only be specified on command line"

**Cause**: `"watch": false` in tsconfig.json

**Solution**: Remove the `watch` property from tsconfig.json

---

### TypeScript Error: "Interface 'Buffer' cannot simultaneously extend types"

**Cause**: @types/node version mismatch with TypeScript version

**Solution**: 
- Use `@types/node": "^13.13.52"` with `typescript": "^5.9.2"`
- Add `"skipLibCheck": true` to tsconfig.json

---

### Linting Error: "no-string-literal: object access via string literals is disallowed"

**Cause**: tslint:recommended includes strict `no-string-literal` rule

**Solution**: Replace `"extends": ["tslint:recommended"]` with explicit rules and set `"no-string-literal": false`

---

## 9. Required Files

### Minimum File Structure

```
extension-name/
├── package.json
├── package-lock.json
├── tsconfig.json
├── tslint.json
├── README.md
├── icon.png (required, any size)
└── src/
    ├── module.ts
    ├── connections/
    │   └── myConnection.ts
    └── nodes/
        ├── node1.ts
        └── node2.ts
```

### README.md Template

Should include:
- Extension overview
- Node descriptions
- Configuration examples
- API requirements
- Authentication details
- Troubleshooting section

### icon.png

- Required for upload
- Any reasonable size (e.g., 128x128px)
- Represents extension in Cognigy UI

---

## 10. Build and Deployment Process

### Build Command

```bash
npm run build
```

Executes: `transpile → lint → zip`

### Upload to Cognigy.AI

1. Build extension: `npm run build`
2. Locate `.tar.gz` file (e.g., `extension-name.tar.gz`)
3. Upload via Cognigy.AI UI: Resources → Extensions → Upload
4. Extension becomes available in Flow Nodes

---

## 11. Testing Checklist

Before uploading:

- [ ] Package name is simple format (no `@scope/`)
- [ ] All node types are globally unique
- [ ] Child node types include parent identifier
- [ ] Module label has no parentheses
- [ ] Connection types are unique
- [ ] TypeScript compiles without errors (`npm run transpile`)
- [ ] Linting passes (`npm run lint`)
- [ ] Package builds successfully (`npm run build`)
- [ ] README.md is complete
- [ ] icon.png exists

---

## 12. Version Management

### Updating Extension

When updating an existing extension:

1. Increment version in `package.json`
2. Update README.md with changelog
3. Rebuild: `npm run build`
4. Upload new package (overwrites previous version)

### Version Format

Follow semantic versioning: `MAJOR.MINOR.PATCH`
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes

---

## 13. Best Practices

### Code Organization

- Keep helper utilities in `src/helpers/`
- One node per file in `src/nodes/`
- Group related nodes in subdirectories if needed
- Export child nodes from same file as parent

### Error Handling

```typescript
try {
  // API call or logic
  api.output("Success", { data });
} catch (error) {
  api.log("error", error.message);
  api.output("Error occurred", { error: error.message });
}
```

### API Integration

- Cache authentication tokens in context when possible
- Use environment variables or connection fields for credentials
- Implement retry logic for transient failures
- Log meaningful error messages

### Context Storage

```typescript
// Store data in context
api.context.setContext("key", value);

// Retrieve data from context
const value = api.context.getContext("key");

// Store in input (for current turn only)
api.input.key = value;
```

---

## 14. Useful Resources

- [Cognigy Extension Tools Documentation](https://github.com/Cognigy/Extensions)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html) (for encryption utilities)

---

## Summary of Key Lessons

1. **Node types must be globally unique** - Most common upload error
2. **Package name must be simple format** - No scoped packages
3. **Module label should be plain text** - No special characters or parentheses
4. **Use latest extension-tools version** - Better compatibility
5. **Disable no-string-literal linting rule** - Required for SIP headers and dynamic properties
6. **Child nodes need unique types** - Append parent identifier (e.g., `onSuccessInit`, `onSuccessSave`)
7. **Include all required files in package** - build/*, package.json, README.md, icon.png
8. **Test build before upload** - Run full `npm run build` to catch errors early

---

**Document Version**: 1.0  
**Last Updated**: February 15, 2026  
**Extension Reference**: CXone SmartReach v1.0.0
