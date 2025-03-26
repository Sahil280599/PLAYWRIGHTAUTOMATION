class Logger {
    constructor(className) {
        this.className = className;
        this.timestamp = new Date().toISOString();
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] [${level}] [${this.className}] ${message}`;
        
        if (data) {
            logMessage += `\nData: ${JSON.stringify(data, null, 2)}`;
        }
        
        return logMessage;
    }

    info(message, data = null) {
        console.log(this.formatMessage('INFO', message, data));
    }

    debug(message, data = null) {
        if (process.env.DEBUG) {
            console.debug(this.formatMessage('DEBUG', message, data));
        }
    }

    warn(message, data = null) {
        console.warn(this.formatMessage('WARN', message, data));
    }

    error(message, error = null) {
        console.error(this.formatMessage('ERROR', message, error));
        if (error) {
            console.error(error.stack);
        }
    }

    step(message, data = null) {
        console.log(this.formatMessage('STEP', `➜ ${message}`, data));
    }

    startAction(message, data = null) {
        console.log(this.formatMessage('ACTION', `▶ ${message}`, data));
    }

    endAction(message, data = null) {
        console.log(this.formatMessage('ACTION', `◀ ${message}`, data));
    }
}

export default Logger; 