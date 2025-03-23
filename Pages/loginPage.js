import { Page } from "@playwright/test";
import { log } from "console";

export default class LoginPage {
    constructor(page) {
        this.page = page;
        // Locators
        this.usernameInput = page.locator("//input[@placeholder='Username']");
        this.passwordInput = page.locator("//input[@placeholder='Password']");
        this.loginButton = page.locator("//button[normalize-space()='Login']");
        this.forgotPasswordLink = page.locator("//p[@class='oxd-text oxd-text--p orangehrm-login-forgot-header']");
    }

    async enterUsername(username) {

        await this.usernameInput.fill(username);
        console.log(`entering username ${username}`);
        await this.page.waitForTimeout(2000);
        
    }

    async enterPassword(password) {
        await this.passwordInput.fill(password);
        console.log(`entering password ${password}`);
        await this.page.waitForTimeout(2000);
    }

    async clickLoginButton() {
        await this.loginButton.click();
        console.log(`clicking login button`);
        await this.page.waitForTimeout(2000);
    }

    async clickForgotPassword() {
        await this.forgotPasswordLink.click();
        console.log(`clicking forgot password link`);
        await this.page.waitForTimeout(2000);
    }

    async login(username, password) {
        await this.enterUsername(username);
        await this.enterPassword(password);
        await this.clickLoginButton();
        console.log(`login successful`);
    }
}

