# Monitoring and Observability Guide

## Overview

Effective monitoring of intelligent UI testing systems requires tracking multiple dimensions: test execution health, system performance, pattern recognition accuracy, and business impact. This guide covers comprehensive observability strategies for production deployments.

## Key Metrics to Monitor

### 1. Test Execution Metrics

#### Success Rate Tracking
```javascript
// Monitor overall test success rates
const testMetrics = {
  totalRuns: 1000,
  successful: 920,
  failed: 80,
  successRate: 0.92,
  trend: 'improving' // improving, declining, stable
};

// Alert thresholds
const alerts = {
  criticalSuccessRate: 0.85, // Alert if below 85%
  warningSuccessRate: 0.90,  // Warning if below 90%
  trendDuration: '24h'       // Time window for trend analysis
};
```

#### Performance Metrics
```javascript
const performanceMetrics = {
  averageExecutionTime: 4200,    // milliseconds
  p95ExecutionTime: 8500,        // 95th percentile
  p99ExecutionTime: 15000,       // 99th percentile
  timeToFirstAction: 850,        // Time to start interacting
  formInferenceTime: 1200,       // AI inference latency
  networkLatency: 120            // Average network response time
};
```

### 2. Form Inference Accuracy

#### Confidence Score Distribution
```javascript
const inferenceMetrics = {
  averageConfidence: 0.87,
  confidenceDistribution: {
    'high (>0.8)': 0.78,      // 78% of inferences are high confidence
    'medium (0.6-0.8)': 0.18, // 18% medium confidence
    'low (<0.6)': 0.04        // 4% low confidence
  },
  falsePositives: 0.03,        // Incorrectly identified forms
  falseNegatives: 0.02,        // Missed forms
  selfHealingSuccess: 0.65     // Successful selector healing rate
};
```

#### Field Type Recognition Accuracy
```javascript
const fieldRecognitionMetrics = {
  emailFields: { accuracy: 0.96, falsePositives: 0.02 },
  passwordFields: { accuracy: 0.94, falsePositives: 0.01 },
  phoneFields: { accuracy: 0.89, falsePositives: 0.04 },
  addressFields: { accuracy: 0.82, falsePositives: 0.06 },
  nameFields: { accuracy: 0.91, falsePositives: 0.03 }
};
```

### 3. Error Detection and Classification

#### Error Type Distribution
```javascript
const errorMetrics = {
  validationErrors: {
    count: 45,
    percentage: 0.56,  // 56% of all errors
    topCauses: [
      'password_complexity',
      'email_format',
      'required_field_missing'
    ]
  },
  networkErrors: {
    count: 20,
    percentage: 0.25,
    topCauses: [
      'timeout',
      'server_error_500',
      'rate_limiting'
    ]
  },
  consoleErrors: {
    count: 15,
    percentage: 0.19,
    topCauses: [
      'javascript_error',
      'missing_resource',
      'csp_violation'
    ]
  }
};
```

### 4. Data Generation Quality

#### Realistic Data Metrics
```javascript
const dataQualityMetrics = {
  dataAcceptanceRate: 0.94,      // How often generated data is accepted
  validationPassRate: 0.91,      // Data passes validation rules
  internationalSupport: {
    emailFormats: 0.98,           // International email acceptance
    phoneFormats: 0.89,           // International phone acceptance
    addressFormats: 0.85          // International address acceptance
  },
  specialCharacterHandling: 0.87  // Names with accents, apostrophes
};
```

## Monitoring Infrastructure

### 1. Metrics Collection

#### Using Prometheus and Grafana

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'mcp-ui-probe'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

```javascript
// Expose metrics endpoint
import client from 'prom-client';

const register = new client.Registry();

// Test execution metrics
const testExecutionCounter = new client.Counter({
  name: 'ui_tests_total',
  help: 'Total number of UI tests executed',
  labelNames: ['result', 'goal_type', 'environment']
});

const testExecutionDuration = new client.Histogram({
  name: 'ui_test_duration_seconds',
  help: 'Duration of UI test execution',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  labelNames: ['goal_type', 'environment']
});

// Form inference metrics
const formInferenceConfidence = new client.Histogram({
  name: 'form_inference_confidence',
  help: 'Confidence score of form inference',
  buckets: [0.3, 0.5, 0.7, 0.8, 0.9, 0.95, 1.0],
  labelNames: ['form_type', 'goal']
});

register.registerMetric(testExecutionCounter);
register.registerMetric(testExecutionDuration);
register.registerMetric(formInferenceConfidence);
```

#### Custom Metrics Tracking

```javascript
// Track metrics during test execution
class MetricsCollector {
  async recordTestExecution(result) {
    testExecutionCounter
      .labels(result.result, result.goalType, process.env.NODE_ENV)
      .inc();

    testExecutionDuration
      .labels(result.goalType, process.env.NODE_ENV)
      .observe(result.metrics.totalTimeMs / 1000);

    if (result.formInference) {
      formInferenceConfidence
        .labels(result.formInference.type, result.goal)
        .observe(result.formInference.confidence);
    }

    // Record detailed metrics
    await this.recordDetailedMetrics(result);
  }

  async recordDetailedMetrics(result) {
    const metrics = {
      timestamp: new Date(),
      runId: result.runId,
      goal: result.goal,
      url: result.target.url,
      result: result.result,
      executionTime: result.metrics.totalTimeMs,
      stepsCount: result.metrics.steps,
      errorsCount: result.errors.length,
      confidence: result.formInference?.confidence,
      selfHealingUsed: result.selfHealingAttempts > 0,
      environment: process.env.NODE_ENV
    };

    // Store in time-series database
    await this.storeMetrics(metrics);
  }
}
```

### 2. Logging Strategy

#### Structured Logging with Winston

```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-ui-probe' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Log test execution events
logger.info('Test execution started', {
  runId: 'uuid',
  goal: 'signup',
  url: 'https://app.example.com',
  timestamp: new Date()
});

logger.info('Form inference completed', {
  runId: 'uuid',
  confidence: 0.87,
  fieldsDetected: 5,
  formType: 'signup'
});

logger.error('Test execution failed', {
  runId: 'uuid',
  error: error.message,
  stack: error.stack,
  selector: '#submit-button',
  step: 'form_submission'
});
```

#### Log Aggregation with ELK Stack

```yaml
# logstash.conf
input {
  file {
    path => "/var/log/mcp-ui-probe/*.log"
    start_position => "beginning"
    codec => "json"
  }
}

filter {
  if [service] == "mcp-ui-probe" {
    mutate {
      add_field => { "index_name" => "mcp-ui-probe-%{+YYYY.MM.dd}" }
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{index_name}"
  }
}
```

### 3. Real-time Alerting

#### AlertManager Configuration

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@company.com'

route:
  group_by: ['alertname']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'web.hook'

receivers:
- name: 'web.hook'
  email_configs:
  - to: 'team@company.com'
    subject: 'UI Testing Alert: {{ .GroupLabels.alertname }}'
    body: |
      {{ range .Alerts }}
      Alert: {{ .Annotations.description }}
      Environment: {{ .Labels.environment }}
      Severity: {{ .Labels.severity }}
      {{ end }}
```

#### Prometheus Alert Rules

```yaml
# alert_rules.yml
groups:
- name: ui_testing
  rules:
  - alert: HighTestFailureRate
    expr: rate(ui_tests_total{result="failed"}[5m]) / rate(ui_tests_total[5m]) > 0.15
    for: 2m
    labels:
      severity: warning
    annotations:
      description: "UI test failure rate is {{ $value | humanizePercentage }} over the last 5 minutes"

  - alert: LowFormInferenceConfidence
    expr: histogram_quantile(0.5, rate(form_inference_confidence_bucket[5m])) < 0.7
    for: 5m
    labels:
      severity: warning
    annotations:
      description: "Median form inference confidence is {{ $value }} which is below threshold"

  - alert: HighTestExecutionTime
    expr: histogram_quantile(0.95, rate(ui_test_duration_seconds_bucket[5m])) > 30
    for: 3m
    labels:
      severity: critical
    annotations:
      description: "95th percentile test execution time is {{ $value }}s"
```

### 4. Performance Monitoring

#### APM Integration with New Relic

```javascript
// newrelic.js
exports.config = {
  app_name: ['MCP UI Probe'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: {
    enabled: true
  },
  logging: {
    level: 'info'
  }
};

// Instrument UI testing operations
const newrelic = require('newrelic');

class InstrumentedFlowEngine {
  async executeFlow(page, form, overrides) {
    return newrelic.startBackgroundTransaction('ui_test_flow', async () => {
      const startTime = Date.now();

      try {
        newrelic.addCustomAttributes({
          formType: form.name,
          fieldsCount: form.fields.length,
          hasOverrides: !!overrides
        });

        const result = await this.flowEngine.executeFlow(page, form, overrides);

        newrelic.recordMetric('Custom/UI_Test/Success', 1);
        newrelic.recordMetric('Custom/UI_Test/Duration', Date.now() - startTime);

        return result;
      } catch (error) {
        newrelic.recordMetric('Custom/UI_Test/Error', 1);
        newrelic.noticeError(error);
        throw error;
      }
    });
  }
}
```

## Dashboard Configuration

### 1. Grafana Dashboards

#### Executive Summary Dashboard

```json
{
  "dashboard": {
    "title": "UI Testing Executive Summary",
    "panels": [
      {
        "title": "Test Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(ui_tests_total{result=\"passed\"}[24h]) / rate(ui_tests_total[24h])",
            "legendFormat": "Success Rate"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "min": 0,
            "max": 1,
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 0.85},
                {"color": "green", "value": 0.90}
              ]
            }
          }
        }
      },
      {
        "title": "Average Execution Time",
        "type": "stat",
        "targets": [
          {
            "expr": "histogram_quantile(0.5, rate(ui_test_duration_seconds_bucket[24h]))",
            "legendFormat": "Median Time"
          }
        ]
      }
    ]
  }
}
```

#### Technical Operations Dashboard

```json
{
  "dashboard": {
    "title": "UI Testing Operations",
    "panels": [
      {
        "title": "Test Execution Volume",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ui_tests_total[5m])",
            "legendFormat": "Tests per second"
          }
        ]
      },
      {
        "title": "Form Inference Confidence Distribution",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(form_inference_confidence_bucket[5m])",
            "legendFormat": "{{le}}"
          }
        ]
      },
      {
        "title": "Error Breakdown",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (error_type) (rate(ui_test_errors_total[1h]))",
            "legendFormat": "{{error_type}}"
          }
        ]
      }
    ]
  }
}
```

### 2. Business Impact Dashboards

#### ROI and Cost Savings

```javascript
// Calculate and display ROI metrics
const roiMetrics = {
  testsAutomated: 1500,
  manualTestingTimeReduced: 375, // hours per month
  averageEngineerCost: 75, // per hour
  monthlySavings: 375 * 75, // $28,125

  bugsFoundEarly: 45,
  productionBugCost: 2500, // average cost per production bug
  costAvoidance: 45 * 2500, // $112,500

  testMaintenanceReduction: 0.80, // 80% reduction
  previousMaintenanceHours: 120,
  newMaintenanceHours: 24,
  maintenanceSavings: (120 - 24) * 75 // $7,200
};

const totalMonthlySavings = roiMetrics.monthlySavings +
                           roiMetrics.costAvoidance +
                           roiMetrics.maintenanceSavings;
```

## Health Checks and SLA Monitoring

### 1. System Health Endpoints

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    checks: {
      browser: await checkBrowserHealth(),
      database: await checkDatabaseHealth(),
      dependencies: await checkExternalDependencies(),
      memory: checkMemoryUsage(),
      disk: checkDiskSpace()
    }
  };

  const isHealthy = Object.values(health.checks).every(check => check.status === 'ok');

  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkBrowserHealth() {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('data:text/html,<h1>Health Check</h1>');
    await browser.close();

    return { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}
```

### 2. SLA Monitoring

```javascript
// SLA metrics tracking
const slaMetrics = {
  availability: {
    target: 0.999,        // 99.9% uptime
    current: 0.9995,      // Current uptime
    breaches: 0           // Number of SLA breaches this month
  },
  performance: {
    target: 10000,        // 10 second max execution time
    p95Current: 8500,     // Current 95th percentile
    breaches: 2           // Times exceeded this month
  },
  accuracy: {
    target: 0.90,         // 90% success rate
    current: 0.94,        // Current success rate
    breaches: 0           // Number of breaches
  }
};

// Alert on SLA breaches
function checkSLABreach(metric, current, target) {
  if (current < target) {
    sendAlert({
      type: 'sla_breach',
      metric,
      current,
      target,
      severity: 'critical'
    });
  }
}
```

## Incident Response

### 1. Runbook for Common Issues

#### High Failure Rate

```bash
# Investigation steps
1. Check recent deployments
   kubectl logs deployment/mcp-ui-probe --tail=100

2. Analyze error patterns
   curl -X GET "elasticsearch:9200/mcp-ui-probe-*/_search" \
     -H 'Content-Type: application/json' \
     -d '{"query": {"range": {"timestamp": {"gte": "now-1h"}}}}'

3. Verify target applications
   curl -I https://app.example.com/health

4. Check browser resources
   docker stats mcp-ui-probe-container
```

#### Performance Degradation

```bash
# Performance investigation
1. Check system resources
   htop
   df -h
   free -m

2. Analyze slow queries
   grep "slow" /var/log/mcp-ui-probe/combined.log

3. Check network latency
   ping app.example.com
   traceroute app.example.com

4. Review browser instances
   ps aux | grep chromium
```

### 2. Automated Recovery

```javascript
// Auto-recovery mechanisms
class HealthMonitor {
  async performHealthCheck() {
    const issues = await this.detectIssues();

    for (const issue of issues) {
      await this.attemptRecovery(issue);
    }
  }

  async attemptRecovery(issue) {
    switch (issue.type) {
      case 'memory_leak':
        await this.restartBrowserInstance();
        break;

      case 'hanging_tests':
        await this.killStaleProcesses();
        break;

      case 'disk_space':
        await this.cleanupOldArtifacts();
        break;

      default:
        await this.escalateToHuman(issue);
    }
  }
}
```

## Continuous Improvement

### 1. Performance Trending

```javascript
// Track performance trends over time
const performanceTrends = {
  executionTime: {
    currentWeek: 4200,
    lastWeek: 4100,
    trend: 'increasing',
    changePercent: 2.4
  },
  successRate: {
    currentWeek: 0.94,
    lastWeek: 0.92,
    trend: 'improving',
    changePercent: 2.2
  },
  inferenceAccuracy: {
    currentWeek: 0.87,
    lastWeek: 0.85,
    trend: 'improving',
    changePercent: 2.4
  }
};

// Generate weekly performance reports
function generatePerformanceReport() {
  return {
    summary: 'Overall system performance improved this week',
    improvements: [
      'Success rate increased by 2.2%',
      'Inference accuracy improved by 2.4%'
    ],
    concerns: [
      'Execution time increased by 2.4% - investigate browser optimization'
    ],
    recommendations: [
      'Enable browser connection pooling',
      'Implement test result caching',
      'Review resource allocation'
    ]
  };
}
```

This comprehensive monitoring strategy ensures reliable operation, quick issue detection, and continuous optimization of intelligent UI testing systems.