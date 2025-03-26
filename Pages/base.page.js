import Logger from '../tests/utils/logger';

export default class BasePage {
    constructor(page, pageName) {
        this.page = page;
        this.logger = new Logger(pageName);
        this.logger.info(`${pageName} initialized`);
    }

    async waitForPageLoad() {
        try {
            this.logger.debug('Waiting for page load');
            await this.page.waitForLoadState('networkidle');
            this.logger.debug('Page loaded successfully');
        } catch (error) {
            this.logger.error('Page load timeout', error);
            throw error;
        }
    }

    async navigate(url) {
        try {
            this.logger.step(`Navigating to ${url}`);
            await this.page.goto(url);
            await this.waitForPageLoad();
            this.logger.step('Navigation completed');
        } catch (error) {
            this.logger.error('Navigation failed', error);
            throw error;
        }
    }

    async waitForElement(element, timeout = 30000) {
        try {
            this.logger.debug(`Waiting for element: ${element}`);
            if (typeof element === 'string') {
                await this.page.waitForSelector(element, { timeout });
            } else {
                await element.waitFor({ timeout });
            }
            this.logger.debug('Element found');
        } catch (error) {
            this.logger.error(`Element not found: ${element}`, error);
            throw error;
        }
    }

    async click(element, timeout = 30000) {
        try {
            this.logger.startAction(`Clicking element: ${element}`);
            await this.waitForElement(element, timeout);
            if (typeof element === 'string') {
                await this.page.click(element);
            } else {
                await element.click();
            }
            this.logger.endAction('Click successful');
        } catch (error) {
            this.logger.error(`Click failed: ${element}`, error);
            throw error;
        }
    }

    async fill(element, value, timeout = 30000) {
        try {
            this.logger.startAction(`Filling element: ${element}`);
            await this.waitForElement(element, timeout);
            if (typeof element === 'string') {
                await this.page.fill(element, value);
            } else {
                await element.fill(value);
            }
            this.logger.endAction('Fill successful');
        } catch (error) {
            this.logger.error(`Fill failed: ${element}`, error);
            throw error;
        }
    }
} 