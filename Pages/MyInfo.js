import { Page } from "@playwright/test";
import BasePage from "./base.page";

export default class myInfo extends BasePage {
    constructor(page) {
        super(page, 'MyInfoPage');
        
        this.myinfoButton = page.locator("//span[normalize-space()='My Info']")
        this.employeeFullname = page.locator("//input[@placeholder='First Name']")
        this.employeeLastname= page.locator("//input[@placeholder='Last Name']")
        this.employeeId = page.locator("//body/div[@id='app']/div[@class='oxd-layout orangehrm-upgrade-layout']/div[@class='oxd-layout-container']/div[@class='oxd-layout-context']/div[@class='orangehrm-background-container']/div[@class='orangehrm-card-container']/div[@class='orangehrm-edit-employee']/div[@class='orangehrm-edit-employee-content']/div[@class='orangehrm-horizontal-padding orangehrm-vertical-padding']/form[@class='oxd-form']/div[@class='oxd-form-row']/div[1]/div[1]/div[1]/div[2]/input[1]")
        this.employeeDriverLicenceNumber = page.locator("//input[@class='oxd-input oxd-input--focus']")
        this.employeeSelectCalendar= page.locator("//body/div[@id='app']/div[@class='oxd-layout orangehrm-upgrade-layout']/div[@class='oxd-layout-container']/div[@class='oxd-layout-context']/div[@class='orangehrm-background-container']/div[@class='orangehrm-card-container']/div[@class='orangehrm-edit-employee']/div[@class='orangehrm-edit-employee-content']/div[@class='orangehrm-horizontal-padding orangehrm-vertical-padding']/form[@class='oxd-form']/div[@class='oxd-form-row']/div[@class='oxd-grid-3 orangehrm-full-width-grid']/div[2]/div[1]/div[2]/div[1]/div[1]/i[1]")
        this.employeeCalendarMonth= page.locator("//div[@class='oxd-calendar-selector-month-selected']//i[@class='oxd-icon bi-caret-down-fill oxd-icon-button__icon']")
        this.employeeCalendarYear = page.locator("//div[@class='oxd-calendar-selector-year-selected']//i[@class='oxd-icon bi-caret-down-fill oxd-icon-button__icon']")
        this.employeeImagePNG = page.locator("//button[3]")
    }

    getCalendarDate(day) {
        return this.page.locator(`//div[contains(@class, 'oxd-calendar-date') and normalize-space()='${day}']`);
    }

    async clickMyInfoButton() {
        await this.click(this.myinfoButton);
        this.logger.info("Clicked on My Info button");
    }

    async downloadImage(){
        try{
            this.logger.startAction('Downloading image');
            
            // Set up download listener before triggering the download
            const downloadPromise = this.page.waitForEvent('download');
            
            // Click the download button
            await this.click(this.employeeImagePNG);
            
            // Wait for the download to start
            const download = await downloadPromise;
            
            // Wait for the download to complete and get the path
            const path = await download.path();
            
            // Verify the download exists
            if (path) {
                // Save downloaded file to a specific location
                const savedPath = await download.saveAs('./downloads/employee_image.png');
                this.logger.endAction(`Image downloaded successfully to ${savedPath}`);
                return savedPath;
            } else {
                throw new Error('Download failed - no file path returned');
            }
        } catch(error) {
            this.logger.error('Failed to download image', error);
            throw error;
        }
    }


}