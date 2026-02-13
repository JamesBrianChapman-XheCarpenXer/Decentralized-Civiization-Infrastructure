/**
 * JSONFlow Bridge - Universal Language Pivot Layer
 * Integrates JSONFlow as a pivot between any languages including natural language
 * Uses browser-safe Ollama for parsing
 * 
 * @author SRCP Integration Team
 * @license MIT
 */

class JSONFlowBridge {
    constructor(config = {}) {
        this.ollamaEndpoint = config.ollamaEndpoint || 'http://localhost:11434';
        this.ollamaModel = config.ollamaModel || 'llama2';
        this.enableLogging = config.enableLogging !== false;
        this.cache = new Map();
    }

    /**
     * Parse natural language to JSONFlow using Ollama
     */
    async naturalLanguageToJSONFlow(text) {
        if (this.cache.has(text)) {
            this.log('Cache hit for:', text);
            return this.cache.get(text);
        }

        const prompt = this.buildNaturalLanguagePrompt(text);
        
        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama request failed: ${response.statusText}`);
            }

            const data = await response.json();
            const jsonFlow = this.extractJSONFlow(data.response);
            
            this.cache.set(text, jsonFlow);
            return jsonFlow;
        } catch (error) {
            this.log('Error parsing with Ollama:', error);
            return this.fallbackParser(text);
        }
    }

    /**
     * Build prompt for Ollama to generate JSONFlow
     */
    buildNaturalLanguagePrompt(text) {
        return `You are a JSONFlow compiler. Convert the following natural language into valid JSONFlow JSON format.

JSONFlow is a structured programming language using JSON. Key constructs:
- "let": { "varName": value } - Create variables
- "set": { "target": path, "value": value } - Update values
- "if": { condition, "then": block, "else": block } - Conditionals
- "expr": { "add"|"sub"|"mul"|"div": [values] } - Expressions
- "assert": { "condition": expr, "message": string } - Assertions
- "return": value - Return value
- "log": { "level": "info"|"warn"|"error", "message": [...] } - Logging
- "get": path - Get value from context/variable

Natural language input:
"${text}"

Generate ONLY valid JSONFlow JSON. Do not include explanations. Output:`;
    }

    /**
     * Extract JSONFlow from Ollama response
     */
    extractJSONFlow(response) {
        try {
            // Try to parse as direct JSON
            return JSON.parse(response);
        } catch {
            // Try to extract JSON from markdown code blocks
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                            response.match(/```\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            
            // Try to find JSON object in text
            const objMatch = response.match(/\{[\s\S]*\}/);
            if (objMatch) {
                return JSON.parse(objMatch[0]);
            }
            
            throw new Error('Could not extract valid JSON from response');
        }
    }

    /**
     * Fallback parser for simple commands when Ollama is unavailable
     */
    fallbackParser(text) {
        const lower = text.toLowerCase().trim();
        
        // Simple pattern matching for common operations
        if (lower.startsWith('set ') || lower.startsWith('let ')) {
            const match = lower.match(/(?:set|let)\s+(\w+)\s+to\s+(.+)/);
            if (match) {
                const [, varName, value] = match;
                return {
                    let: {
                        [varName]: this.parseValue(value)
                    }
                };
            }
        }
        
        if (lower.startsWith('add ') || lower.includes(' + ')) {
            const nums = lower.match(/\d+/g);
            if (nums) {
                return {
                    expr: {
                        add: nums.map(n => parseInt(n))
                    }
                };
            }
        }
        
        if (lower.startsWith('if ')) {
            return {
                if: {
                    condition: { expr: true },
                    then: { log: { message: ['Condition met'] } }
                }
            };
        }
        
        // Default: wrap as log statement
        return {
            log: {
                level: 'info',
                message: [text]
            }
        };
    }

    /**
     * Parse value from string
     */
    parseValue(value) {
        value = value.trim();
        
        // Number
        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return parseFloat(value);
        }
        
        // Boolean
        if (value === 'true') return true;
        if (value === 'false') return false;
        
        // String (remove quotes if present)
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            return value.slice(1, -1);
        }
        
        // Variable reference
        return { get: value };
    }

    /**
     * Compile JSONFlow to target language
     */
    async compileToLanguage(jsonFlow, targetLang) {
        const compilers = {
            'javascript': this.compileToJavaScript.bind(this),
            'python': this.compileToPython.bind(this),
            'solidity': this.compileToSolidity.bind(this),
            'rust': this.compileToRust.bind(this)
        };

        const compiler = compilers[targetLang.toLowerCase()];
        if (!compiler) {
            throw new Error(`Unsupported target language: ${targetLang}`);
        }

        return compiler(jsonFlow);
    }

    /**
     * Compile JSONFlow to JavaScript
     */
    compileToJavaScript(jsonFlow) {
        let code = '// Generated from JSONFlow\n';
        code += this.compileSteps(jsonFlow.steps || [jsonFlow], 'js');
        return code;
    }

    /**
     * Compile JSONFlow to Python
     */
    compileToPython(jsonFlow) {
        let code = '# Generated from JSONFlow\n';
        code += this.compileSteps(jsonFlow.steps || [jsonFlow], 'python');
        return code;
    }

    /**
     * Compile JSONFlow to Solidity
     */
    compileToSolidity(jsonFlow) {
        let code = '// SPDX-License-Identifier: MIT\n';
        code += 'pragma solidity ^0.8.0;\n\n';
        code += `contract ${jsonFlow.function || 'GeneratedContract'} {\n`;
        code += this.compileSteps(jsonFlow.steps || [jsonFlow], 'solidity', '    ');
        code += '}\n';
        return code;
    }

    /**
     * Compile JSONFlow to Rust
     */
    compileToRust(jsonFlow) {
        let code = '// Generated from JSONFlow\n';
        code += `fn ${jsonFlow.function || 'main'}() {\n`;
        code += this.compileSteps(jsonFlow.steps || [jsonFlow], 'rust', '    ');
        code += '}\n';
        return code;
    }

    /**
     * Compile steps to target language
     */
    compileSteps(steps, lang, indent = '') {
        let code = '';
        
        for (const step of steps) {
            if (step.let) {
                code += this.compileLet(step.let, lang, indent);
            } else if (step.set) {
                code += this.compileSet(step.set, lang, indent);
            } else if (step.if) {
                code += this.compileIf(step.if, lang, indent);
            } else if (step.return) {
                code += this.compileReturn(step.return, lang, indent);
            } else if (step.log) {
                code += this.compileLog(step.log, lang, indent);
            } else if (step.assert) {
                code += this.compileAssert(step.assert, lang, indent);
            } else if (step.expr) {
                code += this.compileExpr(step.expr, lang, indent);
            }
        }
        
        return code;
    }

    /**
     * Compile let statement
     */
    compileLet(letStmt, lang, indent) {
        let code = '';
        for (const [varName, value] of Object.entries(letStmt)) {
            const compiledValue = this.compileValue(value, lang);
            switch (lang) {
                case 'js':
                    code += `${indent}let ${varName} = ${compiledValue};\n`;
                    break;
                case 'python':
                    code += `${indent}${varName} = ${compiledValue}\n`;
                    break;
                case 'solidity':
                    code += `${indent}uint256 ${varName} = ${compiledValue};\n`;
                    break;
                case 'rust':
                    code += `${indent}let ${varName} = ${compiledValue};\n`;
                    break;
            }
        }
        return code;
    }

    /**
     * Compile set statement
     */
    compileSet(setStmt, lang, indent) {
        const target = Array.isArray(setStmt.target) ? setStmt.target.join('.') : setStmt.target;
        const value = this.compileValue(setStmt.value, lang);
        
        switch (lang) {
            case 'js':
            case 'python':
                return `${indent}${target} = ${value};\n`;
            case 'solidity':
                return `${indent}${target} = ${value};\n`;
            case 'rust':
                return `${indent}${target} = ${value};\n`;
            default:
                return '';
        }
    }

    /**
     * Compile if statement
     */
    compileIf(ifStmt, lang, indent) {
        const condition = this.compileValue(ifStmt.condition || ifStmt, lang);
        let code = '';
        
        switch (lang) {
            case 'js':
            case 'python':
            case 'rust':
                code += `${indent}if (${condition}) {\n`;
                if (ifStmt.then) {
                    code += this.compileSteps(Array.isArray(ifStmt.then) ? ifStmt.then : [ifStmt.then], lang, indent + '    ');
                }
                code += `${indent}}\n`;
                if (ifStmt.else) {
                    code += `${indent}else {\n`;
                    code += this.compileSteps(Array.isArray(ifStmt.else) ? ifStmt.else : [ifStmt.else], lang, indent + '    ');
                    code += `${indent}}\n`;
                }
                break;
            case 'solidity':
                code += `${indent}if (${condition}) {\n`;
                if (ifStmt.then) {
                    code += this.compileSteps(Array.isArray(ifStmt.then) ? ifStmt.then : [ifStmt.then], lang, indent + '    ');
                }
                code += `${indent}}\n`;
                break;
        }
        
        return code;
    }

    /**
     * Compile return statement
     */
    compileReturn(returnStmt, lang, indent) {
        const value = this.compileValue(returnStmt, lang);
        return `${indent}return ${value};\n`;
    }

    /**
     * Compile log statement
     */
    compileLog(logStmt, lang, indent) {
        const message = Array.isArray(logStmt.message) 
            ? logStmt.message.map(m => this.compileValue(m, lang)).join(' + " " + ')
            : this.compileValue(logStmt.message, lang);
        
        switch (lang) {
            case 'js':
                return `${indent}console.log(${message});\n`;
            case 'python':
                return `${indent}print(${message})\n`;
            case 'solidity':
                return `${indent}emit Log(${message});\n`;
            case 'rust':
                return `${indent}println!("{}", ${message});\n`;
            default:
                return '';
        }
    }

    /**
     * Compile assert statement
     */
    compileAssert(assertStmt, lang, indent) {
        const condition = this.compileValue(assertStmt.condition, lang);
        const message = assertStmt.message ? `"${assertStmt.message}"` : '""';
        
        switch (lang) {
            case 'js':
                return `${indent}if (!(${condition})) throw new Error(${message});\n`;
            case 'python':
                return `${indent}assert ${condition}, ${message}\n`;
            case 'solidity':
                return `${indent}require(${condition}, ${message});\n`;
            case 'rust':
                return `${indent}assert!(${condition}, {});\n`;
            default:
                return '';
        }
    }

    /**
     * Compile expression
     */
    compileExpr(expr, lang, indent = '') {
        if (expr.add) {
            return expr.add.map(v => this.compileValue(v, lang)).join(' + ');
        }
        if (expr.sub) {
            return expr.sub.map(v => this.compileValue(v, lang)).join(' - ');
        }
        if (expr.mul) {
            return expr.mul.map(v => this.compileValue(v, lang)).join(' * ');
        }
        if (expr.div) {
            return expr.div.map(v => this.compileValue(v, lang)).join(' / ');
        }
        if (expr.compare) {
            const left = this.compileValue(expr.compare.left, lang);
            const right = this.compileValue(expr.compare.right, lang);
            return `${left} ${expr.compare.op} ${right}`;
        }
        return 'true';
    }

    /**
     * Compile value (primitive, expression, or reference)
     */
    compileValue(value, lang) {
        if (value === null || value === undefined) {
            return lang === 'python' ? 'None' : 'null';
        }
        
        if (typeof value === 'string') {
            return value.startsWith("'") ? value : `"${value}"`;
        }
        
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        
        if (value.get) {
            const path = Array.isArray(value.get) ? value.get.join('.') : value.get;
            return path;
        }
        
        if (value.expr) {
            return this.compileExpr(value.expr, lang);
        }
        
        return JSON.stringify(value);
    }

    /**
     * Universal translation: Any language to any language
     */
    async translate(input, sourceLang, targetLang) {
        this.log(`Translating from ${sourceLang} to ${targetLang}`);
        
        // Step 1: Convert source to JSONFlow (pivot)
        let jsonFlow;
        if (sourceLang === 'natural' || sourceLang === 'english') {
            jsonFlow = await this.naturalLanguageToJSONFlow(input);
        } else if (sourceLang === 'jsonflow') {
            jsonFlow = typeof input === 'string' ? JSON.parse(input) : input;
        } else {
            // For other languages, use Ollama to convert to JSONFlow
            jsonFlow = await this.sourceToJSONFlow(input, sourceLang);
        }
        
        // Step 2: Convert JSONFlow to target language
        if (targetLang === 'jsonflow') {
            return jsonFlow;
        } else {
            return await this.compileToLanguage(jsonFlow, targetLang);
        }
    }

    /**
     * Convert source language to JSONFlow using Ollama
     */
    async sourceToJSONFlow(code, sourceLang) {
        const prompt = `Convert the following ${sourceLang} code to JSONFlow JSON format:

${code}

Generate ONLY valid JSONFlow JSON:`;

        try {
            const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.ollamaModel,
                    prompt: prompt,
                    stream: false,
                    format: 'json'
                })
            });

            const data = await response.json();
            return this.extractJSONFlow(data.response);
        } catch (error) {
            this.log('Error converting source to JSONFlow:', error);
            throw error;
        }
    }

    /**
     * Execute JSONFlow in browser
     */
    async execute(jsonFlow, context = {}) {
        const runtime = new JSONFlowRuntime(context);
        return await runtime.execute(jsonFlow);
    }

    /**
     * Logging utility
     */
    log(...args) {
        if (this.enableLogging) {
            console.log('[JSONFlowBridge]', ...args);
        }
    }
}

/**
 * JSONFlow Runtime - Execute JSONFlow in browser
 */
class JSONFlowRuntime {
    constructor(initialContext = {}) {
        this.context = { ...initialContext };
        this.variables = {};
    }

    async execute(jsonFlow) {
        const steps = jsonFlow.steps || [jsonFlow];
        let result = null;

        for (const step of steps) {
            result = await this.executeStep(step);
            if (step.return !== undefined) {
                break;
            }
        }

        return result;
    }

    async executeStep(step) {
        if (step.let) {
            return this.executeLet(step.let);
        }
        if (step.set) {
            return this.executeSet(step.set);
        }
        if (step.if) {
            return this.executeIf(step.if);
        }
        if (step.return !== undefined) {
            return this.getValue(step.return);
        }
        if (step.log) {
            return this.executeLog(step.log);
        }
        if (step.assert) {
            return this.executeAssert(step.assert);
        }
        if (step.expr) {
            return this.evaluateExpr(step.expr);
        }
        return null;
    }

    executeLet(letStmt) {
        for (const [varName, value] of Object.entries(letStmt)) {
            this.variables[varName] = this.getValue(value);
        }
        return this.variables;
    }

    executeSet(setStmt) {
        const target = setStmt.target;
        const value = this.getValue(setStmt.value);
        
        if (Array.isArray(target)) {
            let obj = this.context;
            for (let i = 0; i < target.length - 1; i++) {
                obj = obj[target[i]];
            }
            obj[target[target.length - 1]] = value;
        } else {
            this.context[target] = value;
        }
        
        return value;
    }

    executeIf(ifStmt) {
        const condition = this.getValue(ifStmt.condition || ifStmt);
        
        if (condition) {
            if (ifStmt.then) {
                const thenSteps = Array.isArray(ifStmt.then) ? ifStmt.then : [ifStmt.then];
                for (const step of thenSteps) {
                    this.executeStep(step);
                }
            }
        } else if (ifStmt.else) {
            const elseSteps = Array.isArray(ifStmt.else) ? ifStmt.else : [ifStmt.else];
            for (const step of elseSteps) {
                this.executeStep(step);
            }
        }
    }

    executeLog(logStmt) {
        const message = Array.isArray(logStmt.message)
            ? logStmt.message.map(m => this.getValue(m)).join(' ')
            : this.getValue(logStmt.message);
        
        console.log(`[JSONFlow ${logStmt.level || 'info'}]`, message);
        return message;
    }

    executeAssert(assertStmt) {
        const condition = this.getValue(assertStmt.condition);
        if (!condition) {
            throw new Error(assertStmt.message || 'Assertion failed');
        }
        return true;
    }

    evaluateExpr(expr) {
        if (expr.add) {
            return expr.add.reduce((sum, v) => sum + this.getValue(v), 0);
        }
        if (expr.sub) {
            const values = expr.sub.map(v => this.getValue(v));
            return values.reduce((diff, v) => diff - v);
        }
        if (expr.mul) {
            return expr.mul.reduce((prod, v) => prod * this.getValue(v), 1);
        }
        if (expr.div) {
            const values = expr.div.map(v => this.getValue(v));
            return values.reduce((quot, v) => quot / v);
        }
        if (expr.compare) {
            const left = this.getValue(expr.compare.left);
            const right = this.getValue(expr.compare.right);
            switch (expr.compare.op) {
                case '>': return left > right;
                case '<': return left < right;
                case '>=': return left >= right;
                case '<=': return left <= right;
                case '==': return left == right;
                case '===': return left === right;
                case '!=': return left != right;
                case '!==': return left !== right;
                default: return false;
            }
        }
        return null;
    }

    getValue(value) {
        if (value === null || value === undefined) {
            return value;
        }
        
        if (typeof value !== 'object') {
            return value;
        }
        
        if (value.get) {
            const path = Array.isArray(value.get) ? value.get : [value.get];
            let result = this.context;
            
            for (const key of path) {
                if (result && typeof result === 'object' && key in result) {
                    result = result[key];
                } else if (this.variables && key in this.variables) {
                    result = this.variables[key];
                } else {
                    return undefined;
                }
            }
            
            return result;
        }
        
        if (value.expr) {
            return this.evaluateExpr(value.expr);
        }
        
        return value;
    }
}

// Export for use in browser and Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { JSONFlowBridge, JSONFlowRuntime };
}

// ES6 export for modern browsers
export { JSONFlowBridge, JSONFlowRuntime };
