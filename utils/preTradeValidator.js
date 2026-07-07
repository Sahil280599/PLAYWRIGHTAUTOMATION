import fs from 'fs';
import XLSX from 'xlsx';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Unified utility class for Pre-Trade Disclosure validation
 * Handles PDF parsing, Excel reading, and data comparison
 */
export default class PreTradeValidator {
    
    // ==================== PDF METHODS ====================
    
    /**
     * Extract text from PDF file
     * @param {string} pdfPath - Path to the PDF file
     * @returns {Promise<string>} - Extracted text from PDF
     */
    async extractTextFromPDF(pdfPath) {
        const dataBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(dataBuffer);
        return data.text;
    }

    /**
     * Extract Pre-Trade Disclosures from PDF text
     * @param {string} pdfPath - Path to the PDF file
     * @returns {Promise<Array>} - Array of disclosure objects [{riskType, description}]
     */
    async extractPreTradeDisclosuresFromPDF(pdfPath) {
        const pdfText = await this.extractTextFromPDF(pdfPath);
        const disclosures = [];
        
        // Split text into lines
        const lines = pdfText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Find Pre-Trade Disclosures section
        const startIndex = lines.findIndex(line => 
            line.toLowerCase().includes('pre-trade disclosure')
        );
        
        if (startIndex === -1) {
            return disclosures;
        }

        // Parse disclosures dynamically - look for risk patterns
        let currentRiskType = '';
        let currentDescription = '';
        
        for (let i = startIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            
            // Stop at certain section markers
            if (line.toLowerCase().includes('important information') ||
                line.toLowerCase().includes('order details') && i > startIndex + 10) {
                break;
            }
            
            // Check if line looks like a risk type label (usually shorter, no sentence structure)
            // Risk types typically contain words like: risk, tolerance, concentration, bulk, etc.
            const isLikelyRiskType = (
                (line.toLowerCase().includes('risk') || 
                 line.toLowerCase().includes('tolerance') ||
                 line.toLowerCase().includes('concentration') ||
                 line.toLowerCase().includes('bulk')) &&
                line.length < 100 && // Risk labels are usually short
                !line.includes('(') && // Descriptions often have percentages in parentheses
                !line.match(/\d{2,}/) // Descriptions often have numbers
            );
            
            if (isLikelyRiskType && !currentDescription) {
                // This looks like a risk type
                currentRiskType = line;
            } else if (currentRiskType && line.length > 0) {
                // This is part of the description
                currentDescription += (currentDescription ? ' ' : '') + line;
                
                // If description seems complete (contains period or is long enough)
                if (currentDescription.endsWith('.') || currentDescription.length > 150) {
                    disclosures.push({
                        riskType: currentRiskType.trim(),
                        description: currentDescription.trim()
                    });
                    currentRiskType = '';
                    currentDescription = '';
                }
            }
        }
        
        // Add last disclosure if any
        if (currentRiskType && currentDescription) {
            disclosures.push({
                riskType: currentRiskType.trim(),
                description: currentDescription.trim()
            });
        }
        
        return disclosures;
    }

    // ==================== EXCEL METHODS ====================
    
    /**
     * Read Excel file and extract all data
     * @param {string} excelPath - Path to the Excel file
     * @param {string} sheetName - Optional sheet name (defaults to first sheet)
     * @returns {Array} - Array of row objects
     */
    readExcelFile(excelPath, sheetName = null) {
        const workbook = XLSX.readFile(excelPath);
        const sheet = sheetName ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        return data;
    }

    /**
     * Extract Pre-Trade Disclosures from Excel (Ground Truth)
     * Dynamically reads all rows without hardcoding risk types
     * @param {string} excelPath - Path to the Excel file
     * @param {Object} options - Configuration options
     * @returns {Array} - Array of disclosure objects [{riskType, description, rawData}]
     */
    extractPreTradeDisclosuresFromExcel(excelPath, options = {}) {
        const {
            sheetName = null,
            riskTypeColumn = 'Icon label',  // Column name for risk type
            descriptionColumn = 'English'   // Column name for description
        } = options;

        const data = this.readExcelFile(excelPath, sheetName);
        const disclosures = [];

        // Extract all rows that have both risk type and description
        for (const row of data) {
            const riskType = row[riskTypeColumn];
            const description = row[descriptionColumn];
            
            // Only include rows that have both values
            if (riskType && description && 
                riskType.toString().trim() !== '' && 
                description.toString().trim() !== '') {
                
                disclosures.push({
                    riskType: riskType.toString().trim(),
                    description: description.toString().trim(),
                    rawData: row  // Keep original row for debugging
                });
            }
        }

        return disclosures;
    }

    /**
     * Get column names from Excel file
     * @param {string} excelPath - Path to the Excel file
     * @param {string} sheetName - Optional sheet name
     * @returns {Array} - Array of column names
     */
    getExcelColumns(excelPath, sheetName = null) {
        const data = this.readExcelFile(excelPath, sheetName);
        return data.length > 0 ? Object.keys(data[0]) : [];
    }

    // ==================== VALIDATION METHODS ====================
    
    /**
     * Compare PDF disclosures with Excel disclosures (ground truth)
     * @param {Array} pdfDisclosures - Disclosures from PDF
     * @param {Array} excelDisclosures - Disclosures from Excel (ground truth)
     * @param {number} similarityThreshold - Minimum similarity to consider a match (0-1)
     * @returns {Object} - Validation result
     */
    compareDisclosures(pdfDisclosures, excelDisclosures, similarityThreshold = 0.75) {
        const results = {
            matches: [],
            mismatches: [],
            missingInPDF: [],
            extraInPDF: [],
            totalPDF: pdfDisclosures.length,
            totalExcel: excelDisclosures.length,
            passed: false
        };

        // Create a map of Excel disclosures by risk type
        const excelMap = new Map();
        excelDisclosures.forEach((disclosure, index) => {
            const key = this.normalizeText(disclosure.riskType);
            if (!excelMap.has(key)) {
                excelMap.set(key, []);
            }
            excelMap.get(key).push({ ...disclosure, index });
        });

        // Track which Excel entries have been matched
        const matchedExcelIndices = new Set();
        
        // Check each PDF disclosure against Excel
        for (const pdfDisc of pdfDisclosures) {
            const pdfKey = this.normalizeText(pdfDisc.riskType);
            const excelMatches = excelMap.get(pdfKey) || [];
            
            let bestMatch = null;
            let bestSimilarity = 0;
            
            // Find best matching description
            for (const excelDisc of excelMatches) {
                if (matchedExcelIndices.has(excelDisc.index)) {
                    continue;
                }
                
                const similarity = this.calculateSimilarity(
                    pdfDisc.description,
                    excelDisc.description
                );
                
                if (similarity > bestSimilarity) {
                    bestSimilarity = similarity;
                    bestMatch = excelDisc;
                }
            }
            
            if (bestMatch && bestSimilarity >= similarityThreshold) {
                matchedExcelIndices.add(bestMatch.index);
                results.matches.push({
                    riskType: pdfDisc.riskType,
                    pdfDescription: pdfDisc.description,
                    excelDescription: bestMatch.description,
                    similarity: bestSimilarity,
                    status: 'MATCH'
                });
            } else if (bestMatch) {
                matchedExcelIndices.add(bestMatch.index);
                results.mismatches.push({
                    riskType: pdfDisc.riskType,
                    pdfDescription: pdfDisc.description,
                    excelDescription: bestMatch.description,
                    similarity: bestSimilarity,
                    status: 'MISMATCH'
                });
            } else {
                results.extraInPDF.push({
                    riskType: pdfDisc.riskType,
                    pdfDescription: pdfDisc.description,
                    status: 'EXTRA_IN_PDF'
                });
            }
        }

        // Find Excel disclosures not matched in PDF
        excelDisclosures.forEach((excelDisc, index) => {
            if (!matchedExcelIndices.has(index)) {
                results.missingInPDF.push({
                    riskType: excelDisc.riskType,
                    excelDescription: excelDisc.description,
                    status: 'MISSING_IN_PDF'
                });
            }
        });

        // Determine if validation passed
        results.passed = (
            results.mismatches.length === 0 &&
            results.missingInPDF.length === 0 &&
            results.extraInPDF.length === 0
        );

        return results;
    }

    /**
     * Normalize text for comparison
     * @param {string} text - Text to normalize
     * @returns {string} - Normalized text
     */
    normalizeText(text) {
        return text.toLowerCase().trim().replace(/\s+/g, ' ');
    }

    /**
     * Calculate similarity between two strings using Levenshtein distance
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Similarity score (0-1)
     */
    calculateSimilarity(str1, str2) {
        if (!str1 || !str2) return 0;
        
        const s1 = this.normalizeText(str1);
        const s2 = this.normalizeText(str2);
        
        if (s1 === s2) return 1;
        
        const longer = s1.length > s2.length ? s1 : s2;
        const shorter = s1.length > s2.length ? s2 : s1;
        
        if (longer.length === 0) return 1;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} - Edit distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(0));

        for (let i = 0; i <= str2.length; i++) matrix[i][0] = i;
        for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                const cost = str2[i - 1] === str1[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Format validation results as a readable report
     * @param {Object} results - Validation results
     * @returns {string} - Formatted report
     */
    formatReport(results) {
        let report = '\n========== PRE-TRADE DISCLOSURE VALIDATION REPORT ==========\n\n';
        
        report += `Total Disclosures:\n`;
        report += `  📄 PDF: ${results.totalPDF}\n`;
        report += `  📊 Excel (Ground Truth): ${results.totalExcel}\n\n`;
        
        report += `Summary:\n`;
        report += `  ✅ Matches: ${results.matches.length}\n`;
        report += `  ❌ Mismatches: ${results.mismatches.length}\n`;
        report += `  ⚠️  Missing in PDF: ${results.missingInPDF.length}\n`;
        report += `  ⚠️  Extra in PDF: ${results.extraInPDF.length}\n\n`;
        
        report += `Overall Status: ${results.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
        
        if (results.matches.length > 0) {
            report += `✅ MATCHES (${results.matches.length}):\n`;
            report += `${'='.repeat(60)}\n`;
            results.matches.forEach((match, idx) => {
                report += `\n${idx + 1}. Risk Type: ${match.riskType}\n`;
                report += `   Similarity: ${(match.similarity * 100).toFixed(2)}%\n`;
                report += `   Description Match: ✓\n`;
            });
            report += '\n';
        }
        
        if (results.mismatches.length > 0) {
            report += `❌ MISMATCHES (${results.mismatches.length}):\n`;
            report += `${'='.repeat(60)}\n`;
            results.mismatches.forEach((mismatch, idx) => {
                report += `\n${idx + 1}. Risk Type: ${mismatch.riskType}\n`;
                report += `   Similarity: ${(mismatch.similarity * 100).toFixed(2)}%\n`;
                report += `   📄 PDF Description:\n      ${mismatch.pdfDescription}\n`;
                report += `   📊 Excel Description:\n      ${mismatch.excelDescription}\n`;
            });
            report += '\n';
        }
        
        if (results.missingInPDF.length > 0) {
            report += `⚠️  MISSING IN PDF (${results.missingInPDF.length}):\n`;
            report += `${'='.repeat(60)}\n`;
            results.missingInPDF.forEach((missing, idx) => {
                report += `\n${idx + 1}. Risk Type: ${missing.riskType}\n`;
                report += `   📊 Expected (Excel): ${missing.excelDescription}\n`;
            });
            report += '\n';
        }
        
        if (results.extraInPDF.length > 0) {
            report += `⚠️  EXTRA IN PDF (${results.extraInPDF.length}):\n`;
            report += `${'='.repeat(60)}\n`;
            results.extraInPDF.forEach((extra, idx) => {
                report += `\n${idx + 1}. Risk Type: ${extra.riskType}\n`;
                report += `   📄 Found in PDF: ${extra.pdfDescription}\n`;
            });
            report += '\n';
        }
        
        report += '='.repeat(60) + '\n';
        
        return report;
    }

    /**
     * Main validation method - validates PDF against Excel
     * @param {string} pdfPath - Path to PDF file
     * @param {string} excelPath - Path to Excel file
     * @param {Object} options - Configuration options
     * @returns {Promise<Object>} - Validation results
     */
    async validatePreTradeDisclosures(pdfPath, excelPath, options = {}) {
        const {
            excelSheetName = null,
            riskTypeColumn = 'Icon label',
            descriptionColumn = 'English',
            similarityThreshold = 0.75,
            generateReport = true
        } = options;

        // Extract data from both sources
        const pdfDisclosures = await this.extractPreTradeDisclosuresFromPDF(pdfPath);
        const excelDisclosures = this.extractPreTradeDisclosuresFromExcel(excelPath, {
            sheetName: excelSheetName,
            riskTypeColumn,
            descriptionColumn
        });

        // Compare disclosures
        const results = this.compareDisclosures(pdfDisclosures, excelDisclosures, similarityThreshold);

        // Generate report if requested
        if (generateReport) {
            results.report = this.formatReport(results);
        }

        return results;
    }
}
