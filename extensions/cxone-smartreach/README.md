# CXone SmartReach Extension

Integrate **CXone SmartReach (LiveVox)** with Cognigy.AI to enable intelligent AI-powered voice conversations through the AIVA (AI Virtual Agent) platform.

## Overview

This extension enables your Cognigy virtual agents to seamlessly handle calls routed through LiveVox. It provides automatic call initialization, customer data retrieval, secure session management, and call disposition tracking.

**Key Features:**
- 🔐 **Automatic Authentication** - Secure session management with LiveVox APIs
- 📞 **Call Context** - Parse SIP headers and retrieve customer screen pop data
- 📊 **Disposition Tracking** - Save term codes for call outcomes and reporting
- 🔄 **Call Transfer** - Transfer calls to supervisors or other agents
- 📈 **Analytics Integration** - Send conversation data to LiveVox reporting

## Available Nodes

### Init SmartReach Context
Initialize call context by parsing SIP headers, authenticating with LiveVox, and retrieving customer information.

**Use this first** in your flow to set up authentication and store call data that other nodes will use.

### Save Term Code
Save a disposition code when the call completes or escalates to a live agent.

**Common scenarios:**
- Call completed successfully
- Escalated to live agent
- Customer hung up
- Payment processed

### Get Term Codes
Retrieve the list of available disposition codes for your service.

### Read Contact
Retrieve detailed contact information from SmartReach using an account number.

**Returns comprehensive contact data:**
- Personal information (name, email, DOB, SSN, etc.)
- Up to 10 phone numbers with consent status
- Address information
- Account balance and status
- Custom fields and metadata
- DND (Do Not Disturb) settings
- Call attempt history

### Transfer Call
Transfer the active call to a supervisor or another phone number.

### DocDb Reporter
Send conversation details to LiveVox for reporting and analytics.

### SmartReach API Caller
Make custom authenticated API calls to any LiveVox endpoint.

## Requirements

⚠️ **Important**: The **User No Input Timeout** setting in your Cognigy flow must be increased to accommodate the time required for LiveVox API calls to return. Ensure sufficient timeout is configured to prevent premature conversation termination during API operations.

## Quick Start

### 1. Create Connection

Create a new **SmartReach Connection** in Cognigy.AI:

| Field | Description |
|-------|-------------|
| **Access Token** | Your LV-Access header value |
| **Client Name** | LiveVox client name (e.g., `Integration_Services`) |
| **Agent Password** | Shared password for virtual agents |
| **API Base URL** | `https://api.<env>.livevox.com` (production) or `https://api.stg4.livevox.com` (staging) |

### 2. Basic Call Flow

1. **Init SmartReach Context** - Parse call details and authenticate
2. **Your AI Conversation** - Handle the customer interaction
3. **Save Term Code** - Record the call outcome
4. **DocDb Reporter** (optional) - Send conversation data for reporting

### 3. Example with Transfer

1. **Init SmartReach Context** - Initialize the call
2. **AI Logic** - Determine if escalation is needed
3. **Transfer Call** - Send to live agent if required
4. **Save Term Code** - Record escalation disposition

## Connection Setup by Environment

**Production:**
```
API Base URL: https://api.<env>.livevox.com
```

**Staging:**
```
API Base URL: https://api.stg4.livevox.com
```

## Support

- **Cognigy Documentation**: https://docs.cognigy.com
- **LiveVox Documentation**: https://docs.livevox.com/dp/ra/latest/
- **Contact**: Your SmartReach representative

## Version

**Current Version:** 0.1.1 (2026-02-20)

## License

Copyright (c) 2026 NiCE Systems
