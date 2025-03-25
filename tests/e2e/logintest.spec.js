import { test, expect } from '../../fixtures/auth.fixture';
import { URLs } from '../data/urls';

test("verify login success", async ({ loggedInPage }) => {
    // Now you're already logged in and can start testing
    await expect(loggedInPage).toHaveURL(URLs.DASHBOARD_URL);
});

// Example of another test using the logged-in state
test("dashboard test", async ({ loggedInPage }) => {
    // You can directly start testing dashboard features
    // loggedInPage is already authenticated
});