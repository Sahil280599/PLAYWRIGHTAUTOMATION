import { test, expect } from '../../fixtures/auth.fixture';
import { URLs } from '../data/urls';
import MyInfo from '../../Pages/MyInfo';


test("verify login success", async ({ loggedInPage }) => {
    // Now you're already logged in and can start testing
    await expect(loggedInPage).toHaveURL(URLs.DASHBOARD_URL);
});

test("download employee image", async ({ loggedInPage }) => {
    // Verify we're logged in and on the dashboard
    await expect(loggedInPage).toHaveURL(URLs.DASHBOARD_URL);
    
    // Create instance of MyInfo page - pass the page object directly
    const myInfoPage = new MyInfo(loggedInPage);

    await myInfoPage.clickMyInfoButton();
    await myInfoPage.waitForPageLoad();
    await myInfoPage.employeeImagePNG.scrollIntoViewIfNeeded();
    await myInfoPage.waitForElement(myInfoPage.employeeImagePNG, 10000);
    const downloadPath = await myInfoPage.downloadImage();
    
    // Assert that the file was downloaded (check that path exists)
    expect(downloadPath).not.toBeNull();
});


