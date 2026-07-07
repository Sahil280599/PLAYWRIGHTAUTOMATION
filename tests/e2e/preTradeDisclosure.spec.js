import { test, expect } from '../../fixtures/healing.fixture.js';
import path from 'path';
import fs from 'fs';
import PreTradeValidator from '../../utils/preTradeValidator.js';

test.describe('Pre-Trade Disclosure Validation', () => {
    let validator;
    const downloadDir = path.join(process.cwd(), 'downloads');
    const excelPath = path.join(process.cwd(), 'testdata', 'pretrade_groundtruth.xlsx');

    test.beforeEach(() => {
        validator = new PreTradeValidator();
        
        // Create downloads directory if it doesn't exist
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
    });

    test.afterEach(() => {
        // Cleanup: Remove downloaded PDFs after test
        if (fs.existsSync(downloadDir)) {
            const files = fs.readdirSync(downloadDir);
            files.forEach(file => {
                if (file.endsWith('.pdf')) {
                    fs.unlinkSync(path.join(downloadDir, file));
                }
            });
        }
    });

    test('should validate PDF pre-trade disclosures match Excel ground truth', async ({ page }) => {
        // Step 1: Navigate to the application page
        // TODO: Replace with your actual URL
        await page.goto('YOUR_APPLICATION_URL_HERE');
        await page.waitForLoadState('domcontentloaded');

        // Step 2: Download the PDF
        // Option A: If there's a download button
        const downloadPromise = page.waitForEvent('download');
        
        // TODO: Update this selector based on your actual download button
        await page.locator('button:has-text("Download")').click();
        
        const download = await downloadPromise;
        const pdfPath = path.join(downloadDir, download.suggestedFilename() || 'pretrade.pdf');
        await download.saveAs(pdfPath);

        // Verify PDF was downloaded
        expect(fs.existsSync(pdfPath)).toBeTruthy();

        // Step 3: Validate PDF against Excel ground truth
        const results = await validator.validatePreTradeDisclosures(pdfPath, excelPath, {
            riskTypeColumn: 'Icon label',      // Update based on your Excel column name
            descriptionColumn: 'English',      // Update based on your Excel column name
            similarityThreshold: 0.75,         // Adjust as needed (0.75 = 75% similarity)
            generateReport: true
        });

        // Step 4: Assert validation results
        expect(results.mismatches.length, 
            `Found ${results.mismatches.length} mismatches\n${results.report}`
        ).toBe(0);

        expect(results.missingInPDF.length,
            `Found ${results.missingInPDF.length} disclosures missing in PDF\n${results.report}`
        ).toBe(0);

        expect(results.extraInPDF.length,
            `Found ${results.extraInPDF.length} extra disclosures in PDF\n${results.report}`
        ).toBe(0);

        expect(results.passed,
            `Validation failed\n${results.report}`
        ).toBeTruthy();
    });

    test('should validate PDF from print/save as PDF', async ({ page }) => {
        // Alternative method: When there's no download button, generate PDF from page
        
        // Step 1: Navigate to the pre-trade disclosure page
        // TODO: Replace with your actual URL
        await page.goto('YOUR_APPLICATION_URL_HERE');
        await page.waitForLoadState('domcontentloaded');

        // Step 2: Wait for the pre-trade disclosure section to be visible
        // TODO: Update selector based on your actual page structure
        await page.locator('[data-testid="pre-trade-disclosure"]').waitFor({ state: 'visible' });

        // Step 3: Save page as PDF
        const pdfPath = path.join(downloadDir, `pretrade_${Date.now()}.pdf`);
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20px',
                right: '20px',
                bottom: '20px',
                left: '20px'
            }
        });

        // Verify PDF was created
        expect(fs.existsSync(pdfPath)).toBeTruthy();

        // Step 4: Validate PDF against Excel
        const results = await validator.validatePreTradeDisclosures(pdfPath, excelPath, {
            riskTypeColumn: 'Icon label',
            descriptionColumn: 'English',
            similarityThreshold: 0.75,
            generateReport: true
        });

        // Step 5: Assertions
        expect(results.passed, results.report).toBeTruthy();
        expect(results.matches.length).toBeGreaterThan(0);
    });

    test('should extract correct number of disclosures from PDF', async ({ page }) => {
        // This test verifies the PDF contains expected number of disclosures
        
        await page.goto('YOUR_APPLICATION_URL_HERE');
        await page.waitForLoadState('domcontentloaded');

        // Download PDF
        const downloadPromise = page.waitForEvent('download');
        await page.locator('button:has-text("Download")').click();
        const download = await downloadPromise;
        const pdfPath = path.join(downloadDir, download.suggestedFilename());
        await download.saveAs(pdfPath);

        // Extract disclosures from both sources
        const pdfDisclosures = await validator.extractPreTradeDisclosuresFromPDF(pdfPath);
        const excelDisclosures = validator.extractPreTradeDisclosuresFromExcel(excelPath, {
            riskTypeColumn: 'Icon label',
            descriptionColumn: 'English'
        });

        // Verify counts match
        expect(pdfDisclosures.length).toBeGreaterThan(0);
        expect(pdfDisclosures.length).toBe(excelDisclosures.length);
    });

    test('should validate each disclosure type individually', async ({ page }) => {
        // This test validates each disclosure type separately for detailed reporting
        
        await page.goto('YOUR_APPLICATION_URL_HERE');
        await page.waitForLoadState('domcontentloaded');

        const downloadPromise = page.waitForEvent('download');
        await page.locator('button:has-text("Download")').click();
        const download = await downloadPromise;
        const pdfPath = path.join(downloadDir, download.suggestedFilename());
        await download.saveAs(pdfPath);

        const results = await validator.validatePreTradeDisclosures(pdfPath, excelPath, {
            riskTypeColumn: 'Icon label',
            descriptionColumn: 'English',
            similarityThreshold: 0.75,
            generateReport: true
        });

        // Validate each match individually
        results.matches.forEach((match) => {
            expect(match.similarity).toBeGreaterThanOrEqual(0.75);
            expect(match.status).toBe('MATCH');
        });

        // Ensure all expected disclosures are present
        expect(results.missingInPDF).toHaveLength(0);
    });
});

test.describe('Pre-Trade Disclosure - Excel Ground Truth Verification', () => {
    let validator;
    const excelPath = path.join(process.cwd(), 'testdata', 'pretrade_groundtruth.xlsx');

    test.beforeEach(() => {
        validator = new PreTradeValidator();
    });

    test('should verify Excel file exists and has correct structure', () => {
        // Verify Excel file exists
        expect(fs.existsSync(excelPath)).toBeTruthy();

        // Get column names
        const columns = validator.getExcelColumns(excelPath);
        
        // Verify required columns exist
        expect(columns).toContain('Icon label');
        expect(columns).toContain('English');
    });

    test('should extract all disclosures from Excel', () => {
        const disclosures = validator.extractPreTradeDisclosuresFromExcel(excelPath, {
            riskTypeColumn: 'Icon label',
            descriptionColumn: 'English'
        });

        // Verify we have data
        expect(disclosures.length).toBeGreaterThan(0);

        // Verify each disclosure has required fields
        disclosures.forEach((disclosure) => {
            expect(disclosure.riskType).toBeTruthy();
            expect(disclosure.description).toBeTruthy();
            expect(disclosure.riskType.length).toBeGreaterThan(0);
            expect(disclosure.description.length).toBeGreaterThan(0);
        });
    });
});
