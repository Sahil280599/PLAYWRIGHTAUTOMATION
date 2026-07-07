import { test, expect } from '../../fixtures/healing.fixture.js';
import LoginPage from '../../Pages/loginPage.js';
import { URLs } from '../data/urls';

test('user can see and click the Forgot your password link on the login page', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await page.goto(URLs.LOGIN_URL);

    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await loginPage.clickForgotPassword();

    await expect(page).toHaveURL(/requestPasswordResetCode/);
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
});
