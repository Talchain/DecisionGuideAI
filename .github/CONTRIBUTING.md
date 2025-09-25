# Contributing to DecisionGuide AI

Welcome to DecisionGuide AI! We're excited that you're interested in contributing to our scenario analysis platform.

## 🚀 Quick Start

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/DecisionGuideAI-Claude.git
   cd DecisionGuideAI-Claude
   npm ci
   ```

2. **Run Initial Checks**
   ```bash
   npm test
   npm run typecheck
   npm run config:lint
   ```

3. **Start Development**
   ```bash
   npm run dev
   ```

## 📋 Contributing Guidelines

### Safety First

**🔒 Security Rules (Non-Negotiable)**
- Never commit API keys, passwords, or secrets
- Always use simulation mode for testing new features
- Keep powerful features OFF by default (use feature flags)
- Sanitize all logs and error messages
- Report security vulnerabilities privately

**🎯 Platform Principles**
- Simulation mode first, real services second
- Feature flags for all new functionality
- Safe defaults, explicit dangerous options
- Comprehensive testing before production
- Clear documentation for operators

### Development Workflow

**1. Before You Start**
```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Ensure everything is working
npm run release:poc
```

**2. During Development**
```bash
# Use simulation mode for testing
export SIMULATION_MODE=true
npm run dev

# Run tests frequently
npm test
npm run typecheck

# Check for security issues
npm run config:lint
```

**3. Before Submitting**
```bash
# Run full validation suite
npm run release:poc
npm run integration:check
npm run determinism:check

# Check that your changes don't break anything
npm test
npm run typecheck
npm run lint
```

### Code Standards

**TypeScript Guidelines**
- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Use branded types for IDs and critical values
- Document complex type definitions

**React Guidelines**
- Use functional components with hooks
- Implement proper error boundaries
- Use React.memo for expensive components
- Keep components focused and testable

**API Guidelines**
- Follow RESTful patterns
- Use proper HTTP status codes
- Implement comprehensive input validation
- Support streaming for long-running operations
- Always include error handling

**Testing Requirements**
- Unit tests for all business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Performance tests for resource-intensive features

### Feature Development

**Feature Flag Pattern**
```typescript
// src/flags.ts
export const FLAGS = {
  YOUR_NEW_FEATURE: false  // Always start with false
};

// In your component
import { FLAGS } from '@/flags';

if (FLAGS.YOUR_NEW_FEATURE) {
  // New feature code
}
```

**Simulation Mode Pattern**
```typescript
// For testing without real API calls
if (process.env.SIMULATION_MODE === 'true') {
  return mockAnalysisResult();
}

// Real implementation
return await callRealAPI();
```

**Error Handling Pattern**
```typescript
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', {
    error: sanitizeError(error),
    context: sanitizeContext(context)
  });
  throw new SafeError('Operation failed', error.code);
}
```

### Testing Guidelines

**Unit Tests**
- Test business logic thoroughly
- Mock external dependencies
- Use descriptive test names
- Include edge cases and error conditions

**Integration Tests**
- Test API endpoints end-to-end
- Use test database for integration tests
- Clean up test data after each test
- Test authentication and authorization

**E2E Tests**
- Test critical user journeys
- Use realistic test data
- Run against staging environment
- Include performance assertions

### Documentation

**Code Documentation**
- Comment complex algorithms
- Document API endpoints with JSDoc
- Include usage examples
- Explain non-obvious design decisions

**User Documentation**
- Update README for user-facing changes
- Document API changes in OpenAPI spec
- Update operator handbook for operational changes
- Include migration guides for breaking changes

### Security Guidelines

**Input Validation**
```typescript
// Use Zod for runtime validation
const DecisionSchema = z.object({
  title: z.string().min(1).max(200),
  options: z.array(OptionSchema).min(2).max(10)
});

const validated = DecisionSchema.parse(input);
```

**Secrets Management**
```typescript
// Never do this
const apiKey = "sk-1234567890abcdef";

// Do this instead
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

**Error Handling**
```typescript
// Don't expose internal details
catch (error) {
  logger.error('Database query failed', { error });
  throw new Error('Internal server error'); // Generic message
}
```

### Pull Request Process

**1. Create Quality PR**
- Use the PR template
- Fill out all sections completely
- Include screenshots for UI changes
- Reference related issues

**2. Review Process**
- Code review by at least 2 team members
- Security review for security-related changes
- Performance review for performance-critical changes
- Documentation review for user-facing changes

**3. Merge Requirements**
- All tests passing
- No merge conflicts
- All review comments addressed
- Security checklist completed
- Documentation updated

### Release Process

**Feature Flags**
- Start with feature flag OFF
- Test thoroughly in staging
- Enable for beta users first
- Gradual rollout to all users
- Remove flag after stable

**Deployment Safety**
- Use blue-green deployments
- Implement health checks
- Monitor key metrics
- Have rollback plan ready
- Communicate with team

### Common Patterns

**API Endpoint Pattern**
```typescript
export async function POST(request: Request) {
  try {
    // 1. Validate input
    const input = await request.json();
    const validated = RequestSchema.parse(input);

    // 2. Check authentication
    const user = await authenticate(request);

    // 3. Check authorization
    await authorize(user, 'create:decision');

    // 4. Business logic
    const result = await businessLogic(validated, user);

    // 5. Return response
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    return handleAPIError(error);
  }
}
```

**React Component Pattern**
```typescript
interface Props {
  // Define props explicitly
}

export const MyComponent = React.memo<Props>(({ prop1, prop2 }) => {
  // State and hooks
  const [state, setState] = useState();

  // Effects
  useEffect(() => {
    // Side effects
  }, []);

  // Event handlers
  const handleClick = useCallback(() => {
    // Handle events
  }, []);

  // Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
});
```

### Getting Help

**Channels**
- GitHub Issues: Bug reports and feature requests
- GitHub Discussions: Questions and general discussion
- Slack #dev-team: Real-time development chat
- Email: security@company.com for security issues

**Resources**
- [Operator Handbook](./docs/OPERATOR_HANDBOOK.md): Platform operations
- [API Testing Guide](./tools/api-testing-guide.md): Testing your changes
- [Architecture Overview](./docs/ARCHITECTURE.md): System design
- [Security Guidelines](./docs/SECURITY.md): Security best practices

### Recognition

We value all contributions! Contributors will be:
- Listed in our CONTRIBUTORS.md file
- Mentioned in release notes for significant contributions
- Invited to our contributor appreciation events
- Considered for team positions (if interested)

### Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please:
- Be respectful in all interactions
- Focus on the problem, not the person
- Accept constructive feedback gracefully
- Help others learn and grow
- Report unacceptable behavior to maintainers

### Questions?

Don't hesitate to ask questions! We'd rather you ask than guess. The best places to get help are:
1. GitHub Issues for bug reports
2. GitHub Discussions for questions
3. Our development Slack channel for quick questions

Thank you for contributing to DecisionGuide AI! 🚀