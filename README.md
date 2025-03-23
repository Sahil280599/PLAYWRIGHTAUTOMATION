# Playwright Automation Framework

This is an end-to-end testing framework built with Playwright for web application testing. The framework follows the Page Object Model design pattern and includes features like test fixtures, reporting, and configuration management.

## Project Structure

```
├── config/
│   ├── urls.js           # URL configurations
│   └── testData.js       # Test data and credentials
├── fixtures/
│   └── auth.fixture.js   # Authentication fixtures
├── Pages/
│   └── loginPage.js      # Login page object
├── tests/
│   └── logintest.spec.js # Test specifications
├── playwright.config.js  # Playwright configuration
└── package.json         # Project dependencies
```

## Features

- **Page Object Model**: Organized page interactions
- **Test Fixtures**: Reusable authentication and setup
- **Configuration Management**: Centralized URLs and test data
- **HTML Reports**: Detailed test execution reports
- **Screenshots & Videos**: Automatic capture on test failure

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Configuration

### URLs Configuration
Located in `config/urls.js`:
```javascript
export const URLs = {
    BASE_URL: "https://opensource-demo.orangehrmlive.com",
    LOGIN_URL: "https://opensource-demo.orangehrmlive.com/web/index.php/auth/login",
    DASHBOARD_URL: "https://opensource-demo.orangehrmlive.com/web/index.php/dashboard/index"
};
```

### Test Data Configuration
Located in `config/testData.js`:
```javascript
export const TestData = {
    CREDENTIALS: {
        ADMIN: {
            USERNAME: 'Admin',
            PASSWORD: 'admin123'
        },
        USER1: {
            USERNAME: 'User1',
            PASSWORD: 'User123'
        }
    }
};
```

## Running Tests

### Run all tests
```bash
npm run test
```

### Run tests in headed mode
```bash
npm run test:headed
```

### Run tests with UI mode
```bash
npm run test:ui
```

### Run tests and show report
```bash
npm run test:report
```

## Test Reports

After test execution, reports are available in:
- HTML Report: `playwright-report/index.html`
- JSON Results: `test-results.json`

## Page Object Model

### Login Page (`Pages/loginPage.js`)
Contains methods for login page interactions:
- `enterUsername()`
- `enterPassword()`
- `clickLoginButton()`
- `clickForgotPassword()`

## Test Fixtures

### Authentication Fixture (`fixtures/auth.fixture.js`)
Provides a `loggedInPage` fixture that:
- Handles login process
- Waits for navigation
- Returns authenticated page object

Usage in tests:
```javascript
test("your test", async ({ loggedInPage }) => {
    // loggedInPage is already authenticated
    // Start testing your features
});
```

## Best Practices

1. **Page Objects**
   - Keep page interactions in separate page object files
   - Use meaningful method names
   - Include logging for better debugging

2. **Test Data**
   - Store all test data in configuration files
   - Use constants for reusable values
   - Keep sensitive data separate

3. **Test Organization**
   - Use descriptive test names
   - Group related tests together
   - Use fixtures for common setup

4. **Reporting**
   - Check HTML reports after test execution
   - Review screenshots and videos for failed tests
   - Use test traces for debugging

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the ISC License. 