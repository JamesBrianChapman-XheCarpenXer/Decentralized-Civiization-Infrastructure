/**
 * SRCP JSONFlow Integration
 * Ensures JSONFlow editor works as the universal contract/code editor
 * Provides seamless integration with SRCP ecosystem
 */

class SRCPJSONFlowEditor {
  constructor() {
    this.editor = null;
    this.contracts = new Map(); // DID -> contract
    this.executionHistory = [];
    this.storage = window.localStorage;
    this.storageKey = 'srcp:jsonflow:contracts';
  }

  /**
   * Initialize JSONFlow editor
   */
  initialize(editorElement) {
    this.editor = editorElement;
    this.loadContracts();
    this.setupEventListeners();
    console.log('✅ JSONFlow Editor initialized');
  }

  /**
   * Create new JSONFlow contract
   */
  createContract(name, code = null) {
    const contractDID = `did:srcp:contract/${this.generateContractId()}`;
    
    const contract = {
      did: contractDID,
      name: name,
      code: code || this.getDefaultTemplate(),
      created: Date.now(),
      modified: Date.now(),
      author: window.SRCP?.myDID || 'anonymous',
      version: '1.0',
      executions: 0
    };
    
    this.contracts.set(contractDID, contract);
    this.saveContracts();
    
    return contract;
  }

  /**
   * Get default JSONFlow template
   */
  getDefaultTemplate() {
    return {
      "let": {
        "message": "Hello from SRCP JSONFlow!"
      },
      "log": {
        "level": "info",
        "message": ["{{message}}"]
      },
      "return": {
        "success": true,
        "message": "{{message}}"
      }
    };
  }

  /**
   * Parse and validate JSONFlow code
   */
  parseJSONFlow(codeString) {
    try {
      const parsed = JSON.parse(codeString);
      const validation = this.validateJSONFlow(parsed);
      
      if (!validation.valid) {
        throw new Error(`Invalid JSONFlow: ${validation.errors.join(', ')}`);
      }
      
      return {
        valid: true,
        parsed: parsed,
        ast: this.buildAST(parsed)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Validate JSONFlow structure
   */
  validateJSONFlow(flow) {
    const errors = [];
    const validOperations = [
      'let', 'set', 'get', 'if', 'expr', 'assert', 
      'return', 'log', 'call', 'loop', 'break'
    ];
    
    const checkNode = (node, path = 'root') => {
      if (typeof node !== 'object' || node === null) return;
      
      Object.keys(node).forEach(key => {
        if (!validOperations.includes(key) && key !== 'then' && key !== 'else') {
          // Could be a variable or valid structure
          if (typeof node[key] === 'object') {
            checkNode(node[key], `${path}.${key}`);
          }
        }
      });
    };
    
    try {
      checkNode(flow);
    } catch (error) {
      errors.push(error.message);
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Build Abstract Syntax Tree
   */
  buildAST(flow) {
    const ast = {
      type: 'Program',
      body: [],
      timestamp: Date.now()
    };
    
    const parseNode = (node) => {
      if (typeof node !== 'object' || node === null) {
        return { type: 'Literal', value: node };
      }
      
      const entries = Object.entries(node);
      if (entries.length === 0) return { type: 'Empty' };
      
      return entries.map(([op, value]) => ({
        type: 'Operation',
        operation: op,
        value: value,
        children: typeof value === 'object' ? parseNode(value) : null
      }));
    };
    
    ast.body = parseNode(flow);
    return ast;
  }

  /**
   * Execute JSONFlow contract
   */
  async executeContract(contractDID, context = {}) {
    const contract = this.contracts.get(contractDID);
    if (!contract) {
      throw new Error(`Contract not found: ${contractDID}`);
    }
    
    const execution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      contractDID: contractDID,
      startTime: Date.now(),
      context: context,
      logs: [],
      result: null,
      error: null
    };
    
    try {
      const code = typeof contract.code === 'string' 
        ? JSON.parse(contract.code) 
        : contract.code;
      
      const result = await this.evaluate(code, context, execution);
      
      execution.result = result;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
      
      contract.executions++;
      contract.lastExecuted = Date.now();
      
    } catch (error) {
      execution.error = error.message;
      execution.endTime = Date.now();
      execution.duration = execution.endTime - execution.startTime;
    }
    
    this.executionHistory.push(execution);
    this.saveContracts();
    
    return execution;
  }

  /**
   * Evaluate JSONFlow operations
   */
  async evaluate(node, context = {}, execution = null) {
    if (typeof node !== 'object' || node === null) {
      return node;
    }
    
    // Handle string interpolation
    if (typeof node === 'string' && node.includes('{{')) {
      return this.interpolate(node, context);
    }
    
    // Process operations
    for (const [op, value] of Object.entries(node)) {
      switch (op) {
        case 'let':
          Object.assign(context, value);
          break;
          
        case 'set':
          context[value.target] = await this.evaluate(value.value, context, execution);
          break;
          
        case 'get':
          return context[value] || null;
          
        case 'if':
          const condition = await this.evaluate(value.condition, context, execution);
          if (condition) {
            return await this.evaluate(value.then, context, execution);
          } else if (value.else) {
            return await this.evaluate(value.else, context, execution);
          }
          break;
          
        case 'expr':
          return this.evaluateExpression(value, context);
          
        case 'log':
          const logMessage = value.message.map(m => 
            typeof m === 'string' ? this.interpolate(m, context) : m
          ).join(' ');
          
          if (execution) {
            execution.logs.push({
              level: value.level || 'info',
              message: logMessage,
              timestamp: Date.now()
            });
          }
          console.log(`[${value.level || 'info'}]`, logMessage);
          break;
          
        case 'return':
          return await this.evaluate(value, context, execution);
          
        case 'call':
          // Call another contract
          if (value.contract) {
            const result = await this.executeContract(value.contract, value.args || {});
            return result.result;
          }
          break;
          
        case 'loop':
          const results = [];
          const iterations = value.times || value.while || 1;
          for (let i = 0; i < iterations; i++) {
            context._index = i;
            const result = await this.evaluate(value.do, context, execution);
            results.push(result);
          }
          return results;
      }
    }
    
    return context;
  }

  /**
   * Evaluate mathematical expressions
   */
  evaluateExpression(expr, context) {
    if (expr.add) {
      return expr.add.reduce((sum, val) => 
        sum + (typeof val === 'number' ? val : context[val] || 0), 0);
    }
    if (expr.sub) {
      return expr.sub.reduce((diff, val, i) => 
        i === 0 ? val : diff - (typeof val === 'number' ? val : context[val] || 0));
    }
    if (expr.mul) {
      return expr.mul.reduce((prod, val) => 
        prod * (typeof val === 'number' ? val : context[val] || 1), 1);
    }
    if (expr.div) {
      return expr.div.reduce((quot, val, i) => 
        i === 0 ? val : quot / (typeof val === 'number' ? val : context[val] || 1));
    }
    if (expr.eq) {
      return expr.eq[0] === expr.eq[1];
    }
    if (expr.gt) {
      return expr.gt[0] > expr.gt[1];
    }
    if (expr.lt) {
      return expr.lt[0] < expr.lt[1];
    }
    return null;
  }

  /**
   * String interpolation
   */
  interpolate(str, context) {
    return str.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      return context[key.trim()] || match;
    });
  }

  /**
   * Save contract
   */
  saveContract(contractDID, code) {
    const contract = this.contracts.get(contractDID);
    if (!contract) {
      throw new Error('Contract not found');
    }
    
    contract.code = code;
    contract.modified = Date.now();
    this.saveContracts();
  }

  /**
   * Get all contracts
   */
  getAllContracts() {
    return Array.from(this.contracts.values()).sort((a, b) => 
      b.modified - a.modified
    );
  }

  /**
   * Delete contract
   */
  deleteContract(contractDID) {
    this.contracts.delete(contractDID);
    this.saveContracts();
  }

  /**
   * Generate contract ID
   */
  generateContractId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Save contracts to storage
   */
  saveContracts() {
    try {
      const data = {
        contracts: Array.from(this.contracts.entries()),
        executionHistory: this.executionHistory.slice(-100), // Keep last 100
        timestamp: Date.now()
      };
      this.storage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save contracts:', error);
    }
  }

  /**
   * Load contracts from storage
   */
  loadContracts() {
    try {
      const stored = this.storage.getItem(this.storageKey);
      if (!stored) return;
      
      const data = JSON.parse(stored);
      this.contracts = new Map(data.contracts || []);
      this.executionHistory = data.executionHistory || [];
      
      console.log('Loaded JSONFlow contracts:', this.contracts.size);
    } catch (error) {
      console.error('Failed to load contracts:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for contract execution requests
    window.addEventListener('srcp:jsonflow:execute', (event) => {
      const { contractDID, context } = event.detail;
      this.executeContract(contractDID, context);
    });
  }

  /**
   * Export contract
   */
  exportContract(contractDID) {
    const contract = this.contracts.get(contractDID);
    if (!contract) return null;
    
    return {
      ...contract,
      exported: Date.now(),
      format: 'srcp-jsonflow-v1'
    };
  }

  /**
   * Import contract
   */
  importContract(contractData) {
    if (contractData.format !== 'srcp-jsonflow-v1') {
      throw new Error('Unsupported contract format');
    }
    
    const contractDID = contractData.did || `did:srcp:contract/${this.generateContractId()}`;
    this.contracts.set(contractDID, {
      ...contractData,
      imported: Date.now()
    });
    
    this.saveContracts();
    return contractDID;
  }
}

// Make globally available
if (typeof window !== 'undefined') {
  window.SRCPJSONFlowEditor = SRCPJSONFlowEditor;
  
  // Auto-initialize
  window.initJSONFlowEditor = function(editorElement) {
    const editor = new SRCPJSONFlowEditor();
    editor.initialize(editorElement);
    window.srcpJSONFlow = editor;
    return editor;
  };
}
