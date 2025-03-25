import { test as base } from '@playwright/test';
import LoginPage from '../Pages/loginPage';
import { URLs } from '../tests/data/urls';
import { TestData } from '../tests/data/testData';

// Declare the types of fixtures
export const test = base.extend({
    loggedInPage: async ({ page }, use) => {
        const loginPage = new LoginPage(page);
        
        // Perform login
        await page.goto(URLs.LOGIN_URL);
        await loginPage.enterUsername(TestData.CREDENTIALS.ADMIN.USERNAME);
        await loginPage.enterPassword(TestData.CREDENTIALS.ADMIN.PASSWORD);
        await loginPage.clickLoginButton();
        
        // Wait for navigation to dashboard
        await page.waitForURL(URLs.DASHBOARD_URL);
        
        // Use the logged-in page
        await use(page);
    }
});

// Export expect from the base test
export { expect } from '@playwright/test'; 