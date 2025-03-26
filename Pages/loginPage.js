import { Page } from "@playwright/test";
import BasePage from './base.page';

export default class LoginPage extends BasePage {
    constructor(page) {
        super(page, 'LoginPage');
        
        // Locators
        this.usernameInput = page.locator("//input[@placeholder='Username']");
        this.passwordInput = page.locator("//input[@placeholder='Password']");
        this.loginButton = page.locator("//button[normalize-space()='Login']");
        this.forgotPasswordLink = page.locator("//p[@class='oxd-text oxd-text--p orangehrm-login-forgot-header']");
    }

    async enterUsername(username) {
        try {
            this.logger.startAction('Entering username', { username });
            await this.fill(this.usernameInput, username);
            this.logger.endAction('Username entered successfully');
        } catch (error) {
            this.logger.error('Failed to enter username', error);
            throw error;
        }
    }

    async enterPassword(password) {
        try {
            this.logger.startAction('Entering password');
            await this.fill(this.passwordInput, password);
            this.logger.endAction('Password entered successfully');
        } catch (error) {
            this.logger.error('Failed to enter password', error);
            throw error;
        }
    }

    async clickLoginButton() {
        try {
            this.logger.startAction('Clicking login button');
            await this.click(this.loginButton);
            this.logger.endAction('Login button clicked successfully');
        } catch (error) {
            this.logger.error('Failed to click login button', error);
            throw error;
        }
    }

    async clickForgotPassword() {
        try {
            this.logger.startAction('Clicking forgot password link');
            await this.click(this.forgotPasswordLink);
            this.logger.endAction('Forgot password link clicked successfully');
        } catch (error) {
            this.logger.error('Failed to click forgot password link', error);
            throw error;
        }
    }

    async login(username, password) {
        try {
            this.logger.step('Starting login process', { username });
            await this.enterUsername(username);
            await this.enterPassword(password);
            await this.clickLoginButton();
            this.logger.step('Login process completed successfully');
        } catch (error) {
            this.logger.error('Login process failed', error);
            throw error;
        }
    }
}

