# Real-World Testing Scenarios

## E-commerce Scenarios

### 1. User Registration Flow

**Business Context:** New customer signs up for an online shopping platform

```javascript
// Scenario: Complete user registration with email verification
const registrationTest = await mcpClient.call('run_flow', {
  goal: 'Complete new user registration',
  url: 'https://shop.example.com/register',
  constraints: {
    requireEmailVerification: true,
    requireTermsAcceptance: true,
    collectMarketingConsent: true
  }
});

// Expected validations:
// - Email format validation
// - Password strength requirements
// - Terms of service checkbox
// - Marketing consent (optional)
// - Age verification (if required)
```

**Real-world variations to test:**
- International email formats (`test@company.co.uk`, `user@domain-name.org`)
- Special characters in names (`María José`, `O'Connor`, `李小明`)
- Different phone number formats (`+1-555-123-4567`, `(555) 123-4567`)
- Long form fields (testing character limits)

### 2. Checkout Process

**Business Context:** Customer completes purchase with payment processing

```javascript
// Scenario: Complete checkout with credit card payment
const checkoutTest = await mcpClient.call('run_flow', {
  goal: 'Complete purchase with credit card',
  url: 'https://shop.example.com/checkout',
  constraints: {
    paymentMethod: 'credit_card',
    requireBillingAddress: true,
    validateCreditCard: true,
    applyDiscount: 'SAVE10'
  }
});

// Test multiple payment scenarios
const paymentScenarios = [
  {
    name: 'Valid Visa Card',
    overrides: {
      cardNumber: '4111111111111111',
      expiryDate: '12/25',
      cvv: '123'
    }
  },
  {
    name: 'Expired Card',
    overrides: {
      cardNumber: '4111111111111111',
      expiryDate: '01/20',
      cvv: '123'
    }
  },
  {
    name: 'Invalid CVV',
    overrides: {
      cardNumber: '4111111111111111',
      expiryDate: '12/25',
      cvv: '12'
    }
  }
];

for (const scenario of paymentScenarios) {
  const result = await mcpClient.call('fill_and_submit', {
    formSchema: checkoutForm,
    overrides: scenario.overrides
  });

  console.log(`${scenario.name}: ${result.result}`);
  if (scenario.name.includes('Valid')) {
    expect(result.result).toBe('passed');
  } else {
    expect(result.errors.some(e => e.type === 'validation')).toBe(true);
  }
}
```

### 3. Product Search and Filtering

**Business Context:** Customer searches for products and applies filters

```javascript
// Scenario: Search for products and apply filters
await mcpClient.call('navigate', { url: 'https://shop.example.com' });

// Search for a product
const searchResult = await mcpClient.call('fill_and_submit', {
  formSchema: searchForm,
  overrides: {
    searchQuery: 'wireless headphones',
    category: 'Electronics'
  }
});

// Apply filters
const filterTest = await mcpClient.call('run_flow', {
  goal: 'Apply product filters',
  constraints: {
    priceRange: '$50-$200',
    brand: 'Sony',
    rating: '4+ stars',
    inStock: true
  }
});
```

## SaaS Platform Scenarios

### 4. Team Collaboration Setup

**Business Context:** New team admin sets up workspace and invites members

```javascript
// Scenario: Create team workspace and invite members
const teamSetupTest = await mcpClient.call('run_flow', {
  goal: 'Set up team workspace with member invitations',
  url: 'https://app.example.com/teams/create',
  constraints: {
    teamSize: 'medium',
    plan: 'professional',
    inviteMembers: true
  }
});

// Test member invitation flow
const invitationData = [
  {
    email: 'alice@company.com',
    role: 'admin',
    permissions: ['read', 'write', 'manage']
  },
  {
    email: 'bob@company.com',
    role: 'member',
    permissions: ['read', 'write']
  },
  {
    email: 'carol@external.com',
    role: 'guest',
    permissions: ['read']
  }
];

for (const member of invitationData) {
  const inviteResult = await mcpClient.call('fill_and_submit', {
    formSchema: inviteForm,
    overrides: member
  });

  expect(inviteResult.result).toBe('passed');
}
```

### 5. Subscription and Billing

**Business Context:** User upgrades subscription plan with billing changes

```javascript
// Scenario: Upgrade subscription plan
const subscriptionTest = await mcpClient.call('run_flow', {
  goal: 'Upgrade to premium subscription',
  url: 'https://app.example.com/billing',
  constraints: {
    newPlan: 'premium',
    billingCycle: 'annual',
    updatePaymentMethod: true
  }
});

// Test billing scenarios
const billingScenarios = [
  {
    name: 'Annual billing discount',
    plan: 'premium',
    cycle: 'annual',
    expectedDiscount: '20%'
  },
  {
    name: 'Monthly billing',
    plan: 'premium',
    cycle: 'monthly',
    expectedDiscount: null
  },
  {
    name: 'Downgrade plan',
    plan: 'basic',
    cycle: 'monthly',
    expectWarning: 'feature_loss'
  }
];
```

## Financial Services Scenarios

### 6. Loan Application Process

**Business Context:** Customer applies for personal loan with financial verification

```javascript
// Scenario: Complete loan application
const loanApplicationTest = await mcpClient.call('run_flow', {
  goal: 'Submit personal loan application',
  url: 'https://bank.example.com/loans/personal',
  constraints: {
    loanAmount: 25000,
    purpose: 'home_improvement',
    employmentVerification: true,
    creditCheck: true
  }
});

// Test with various financial profiles
const applicantProfiles = [
  {
    name: 'High Credit Score',
    overrides: {
      annualIncome: 85000,
      creditScore: 750,
      employmentYears: 5,
      debt: 5000
    }
  },
  {
    name: 'Moderate Credit',
    overrides: {
      annualIncome: 55000,
      creditScore: 650,
      employmentYears: 2,
      debt: 15000
    }
  },
  {
    name: 'Low Credit Score',
    overrides: {
      annualIncome: 35000,
      creditScore: 550,
      employmentYears: 1,
      debt: 25000
    }
  }
];

for (const profile of applicantProfiles) {
  const result = await mcpClient.call('fill_and_submit', {
    formSchema: loanForm,
    overrides: profile.overrides
  });

  console.log(`${profile.name}: ${result.result}`);

  // Verify appropriate risk assessment
  if (profile.overrides.creditScore >= 700) {
    expect(result.errors.length).toBe(0);
  } else if (profile.overrides.creditScore < 600) {
    expect(result.errors.some(e => e.message.includes('additional documentation'))).toBe(true);
  }
}
```

### 7. Investment Account Opening

**Business Context:** Customer opens investment account with regulatory compliance

```javascript
// Scenario: Open investment account with KYC compliance
const investmentAccountTest = await mcpClient.call('run_flow', {
  goal: 'Open investment account with identity verification',
  url: 'https://investment.example.com/account/open',
  constraints: {
    accountType: 'individual',
    investmentExperience: 'moderate',
    riskTolerance: 'medium',
    kycRequired: true
  }
});

// Test regulatory compliance scenarios
const complianceTests = [
  {
    scenario: 'US Resident',
    overrides: {
      country: 'United States',
      taxId: '123-45-6789',
      investmentExperience: 'experienced',
      netWorth: 500000
    }
  },
  {
    scenario: 'International Customer',
    overrides: {
      country: 'Canada',
      taxId: '123456789',
      investmentExperience: 'beginner',
      netWorth: 50000
    }
  }
];
```

## Healthcare Scenarios

### 8. Patient Registration

**Business Context:** New patient registers for healthcare services with HIPAA compliance

```javascript
// Scenario: Patient registration with medical history
const patientRegistrationTest = await mcpClient.call('run_flow', {
  goal: 'Complete patient registration',
  url: 'https://clinic.example.com/register',
  constraints: {
    requireInsurance: true,
    medicalHistory: true,
    emergencyContact: true,
    hipaaConsent: true
  }
});

// Test with sensitive data handling
const patientScenarios = [
  {
    name: 'Standard Registration',
    overrides: {
      insurance: 'Blue Cross Blue Shield',
      policyNumber: 'BC123456789',
      allergies: 'Penicillin',
      medications: 'Lisinopril 10mg daily'
    }
  },
  {
    name: 'Uninsured Patient',
    overrides: {
      insurance: null,
      paymentMethod: 'self_pay',
      medicalHistory: 'diabetes, hypertension'
    }
  }
];
```

### 9. Appointment Scheduling

**Business Context:** Patient schedules medical appointment with provider availability

```javascript
// Scenario: Schedule appointment with provider
const appointmentTest = await mcpClient.call('run_flow', {
  goal: 'Schedule medical appointment',
  url: 'https://clinic.example.com/appointments',
  constraints: {
    provider: 'Dr. Smith',
    appointmentType: 'routine_checkup',
    timePreference: 'morning',
    insuranceVerification: true
  }
});

// Test scheduling conflicts and availability
const schedulingScenarios = [
  {
    name: 'Preferred Time Available',
    overrides: {
      date: '2024-10-15',
      time: '09:00',
      provider: 'Dr. Smith'
    }
  },
  {
    name: 'Preferred Time Unavailable',
    overrides: {
      date: '2024-10-15',
      time: '09:00',
      provider: 'Dr. Johnson'
    }
  }
];
```

## Educational Platform Scenarios

### 10. Student Enrollment

**Business Context:** Student enrolls in online course with payment processing

```javascript
// Scenario: Enroll in online course
const enrollmentTest = await mcpClient.call('run_flow', {
  goal: 'Enroll in online course with payment',
  url: 'https://education.example.com/courses/javascript-fundamentals',
  constraints: {
    paymentPlan: 'full_payment',
    studentDiscount: true,
    certificateRequired: true
  }
});

// Test various enrollment scenarios
const studentProfiles = [
  {
    name: 'Full-time Student',
    overrides: {
      studentStatus: 'full_time',
      discountCode: 'STUDENT20',
      paymentMethod: 'parent_card'
    }
  },
  {
    name: 'Working Professional',
    overrides: {
      studentStatus: 'working_professional',
      paymentPlan: 'installments',
      companySponsored: true
    }
  }
];
```

## Government Services Scenarios

### 11. License Renewal

**Business Context:** Citizen renews driver's license online

```javascript
// Scenario: Renew driver's license online
const licenseRenewalTest = await mcpClient.call('run_flow', {
  goal: 'Renew driver license online',
  url: 'https://dmv.state.gov/renewal',
  constraints: {
    visionTest: 'completed',
    feePayment: 'credit_card',
    addressUpdate: false,
    expedited: true
  }
});

// Test government ID verification
const verificationScenarios = [
  {
    name: 'Standard Renewal',
    overrides: {
      licenseNumber: 'D123456789',
      ssn: '123-45-6789',
      dateOfBirth: '1985-05-15'
    }
  },
  {
    name: 'Address Change',
    overrides: {
      licenseNumber: 'D123456789',
      newAddress: '123 New Street, City, ST 12345',
      proofOfResidency: 'utility_bill'
    }
  }
];
```

## Performance and Load Testing Scenarios

### 12. High-Traffic Event Registration

**Business Context:** Concert ticket sales with high concurrent users

```javascript
// Scenario: High-demand ticket purchase
const ticketPurchaseTest = await mcpClient.call('run_flow', {
  goal: 'Purchase concert tickets during high demand',
  url: 'https://tickets.example.com/events/concert-2024',
  constraints: {
    ticketQuantity: 2,
    seatPreference: 'best_available',
    timeLimit: '10_minutes',
    queuing: true
  }
});

// Simulate concurrent users
const concurrentTests = Array.from({ length: 50 }, (_, i) =>
  mcpClient.call('run_flow', {
    goal: 'Purchase tickets',
    url: 'https://tickets.example.com/events/concert-2024',
    constraints: {
      userId: `user_${i}`,
      ticketQuantity: Math.floor(Math.random() * 4) + 1
    }
  })
);

const results = await Promise.allSettled(concurrentTests);
const successful = results.filter(r => r.status === 'fulfilled' && r.value.result === 'passed');
const failed = results.filter(r => r.status === 'rejected' || r.value.result === 'failed');

console.log(`Successful purchases: ${successful.length}`);
console.log(`Failed purchases: ${failed.length}`);
```

## Accessibility Testing Scenarios

### 13. Screen Reader Compatibility

**Business Context:** Visually impaired user navigates website using screen reader

```javascript
// Scenario: Screen reader navigation testing
const accessibilityTest = await mcpClient.call('run_flow', {
  goal: 'Complete form using keyboard navigation only',
  url: 'https://app.example.com/contact',
  constraints: {
    keyboardOnly: true,
    screenReader: true,
    highContrast: true,
    skipLinks: true
  }
});

// Test accessibility features
const a11yScenarios = [
  {
    name: 'Tab Navigation',
    test: async () => {
      const tabOrder = await mcpClient.call('analyze_ui', {
        scope: 'document',
        focus: 'tab_order'
      });

      // Verify logical tab order
      expect(tabOrder.elements.every(el => el.tabIndex >= 0)).toBe(true);
    }
  },
  {
    name: 'Screen Reader Labels',
    test: async () => {
      const elements = await mcpClient.call('analyze_ui', {
        scope: 'document',
        focus: 'aria_labels'
      });

      // Verify all interactive elements have labels
      const unlabeledElements = elements.inputs.filter(el =>
        !el.attributes['aria-label'] && !el.label
      );

      expect(unlabeledElements.length).toBe(0);
    }
  }
];
```

## Integration Testing Scenarios

### 14. Third-Party Service Integration

**Business Context:** Application integrates with external payment processor

```javascript
// Scenario: Payment processor integration
const integrationTest = await mcpClient.call('run_flow', {
  goal: 'Process payment through Stripe integration',
  url: 'https://app.example.com/checkout',
  constraints: {
    paymentProcessor: 'stripe',
    webhookValidation: true,
    errorHandling: true,
    fallbackProcessor: 'paypal'
  }
});

// Test integration failure scenarios
const failureScenarios = [
  {
    name: 'Network Timeout',
    mockFailure: 'network_timeout',
    expectedBehavior: 'retry_with_fallback'
  },
  {
    name: 'Invalid API Key',
    mockFailure: 'authentication_error',
    expectedBehavior: 'error_message_displayed'
  },
  {
    name: 'Service Unavailable',
    mockFailure: 'service_unavailable',
    expectedBehavior: 'fallback_processor_used'
  }
];
```

These real-world scenarios demonstrate how intelligent UI testing can cover complex business flows, handle diverse user profiles, and validate critical functionality across different industries and use cases.