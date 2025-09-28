# Operations Console

Read-only dashboard for system monitoring and health checks.

## Overview

The Operations Console provides a web-based interface for monitoring system health, queue status, usage metrics, and recent activity. It's designed for development and pilot deployments only.

## Configuration

### Enable the Console

```bash
# Enable ops console (default: disabled)
export OPS_CONSOLE_ENABLE=1

# Optional: Set authentication token for non-localhost access
export OPS_CONSOLE_TOKEN="your-secret-ops-token"
```

### Access

- **URL**: `GET /ops`
- **Localhost**: No authentication required when accessing from `localhost` or `127.0.0.1`
- **Remote**: Requires `Authorization: Bearer <OPS_CONSOLE_TOKEN>` header

## Authentication

### Localhost Mode
When accessing from localhost, no authentication is required:
```bash
curl http://localhost:3001/ops
```

### Remote Access
For non-localhost access, you must provide the token:
```bash
curl -H "Authorization: Bearer your-secret-ops-token" \
     https://your-domain.com/ops
```

### Status Code Matrix

| Condition | Request Source | Token | Response |
|-----------|----------------|--------|----------|
| **Disabled** (`OPS_CONSOLE_ENABLE` unset or "0") | Any | Any | **404 Not Found** |
| **Enabled** | `localhost`/`127.0.0.1` | Not required | **200 OK** |
| **Enabled** | Non-localhost | Valid `Authorization: Bearer <token>` | **200 OK** |
| **Enabled** | Non-localhost | Missing/invalid token | **401 Unauthorized** + `WWW-Authenticate: Bearer` |

### Security Headers
The console includes security headers:
- `X-Frame-Options: DENY` - Prevents iframe embedding
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `Cache-Control: no-store` - Prevents caching

## Dashboard Features

### System Health
- Overall status (healthy/degraded/error)
- API version information
- Response time metrics
- System uptime

### Queue Status
- Current queue depth per organisation
- Active concurrent runs
- Maximum concurrency limits
- Estimated wait times

### Usage Summary (7 days)
- Total runs completed
- Median time to first token (TTFF)
- Median cancellation latency
- Rate limit encounters
- Estimated token usage

### Synthetic Monitoring
- Latest canary test results
- Pass/fail status
- Last execution timestamp
- Test duration and check counts

### Recent Snapshots (7 days)
- List of recent scenario executions
- Run IDs, scenario details, and performance metrics
- Creation timestamps and metadata

## Features

### Auto-refresh
- Dashboard refreshes every 30 seconds automatically
- Manual refresh button available
- Real-time timestamps show last update

### Read-only Design
- No destructive operations available
- Cannot modify system state
- Safe for operator use

### Error Handling
- Graceful handling of missing data
- Clear error messages for failed requests
- Continues functioning if individual components fail

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPS_CONSOLE_ENABLE` | `0` | Enable the ops console (set to `1`) |
| `OPS_CONSOLE_TOKEN` | - | Authentication token for remote access |

## Troubleshooting

### Console Not Available
If you get a 404 error:
1. Verify `OPS_CONSOLE_ENABLE=1` is set
2. Restart the service after setting the environment variable
3. Check that the HTML file exists at `artifacts/public/ops-console.html`

### Authentication Errors
If you get a 401 error:
1. Ensure you're accessing from localhost, or
2. Set `OPS_CONSOLE_TOKEN` and include it in the `Authorization` header
3. Verify the token format: `Bearer your-token`

### Missing Data
If dashboard sections show "Loading..." or errors:
1. Check that the underlying endpoints are available:
   - `/healthz` for system health
   - `/queue/status?org=acme` for queue data
   - `/usage/summary?org=acme&period=7d` for usage data
   - `/_status/synth-latest` for canary results
   - `/snapshots?org=acme&since=<date>` for snapshots
2. Verify network connectivity and CORS settings

### Performance
- Console makes multiple API calls on load and refresh
- Auto-refresh can be disabled by modifying the HTML
- Consider adjusting refresh interval for production use

## Security Considerations

- **Development/Pilot Only**: Not intended for production environments
- **Token Security**: Keep `OPS_CONSOLE_TOKEN` secure and rotate regularly
- **Network Access**: Consider restricting access via firewall rules
- **HTTPS**: Always use HTTPS in non-localhost deployments
- **Logging**: Console access is logged but tokens are not exposed

## Integration

The console reads from existing API endpoints and requires no additional setup beyond enabling the feature. It's designed to work with the existing authentication and monitoring infrastructure.

For automated monitoring, consider using the individual API endpoints directly rather than scraping the HTML interface.