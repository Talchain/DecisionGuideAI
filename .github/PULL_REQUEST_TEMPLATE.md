# Pull Request

## 📋 Summary

<!-- Provide a brief summary of the changes in this PR -->

**Type of Change:**
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation (changes to documentation only)
- [ ] 🔧 Refactor (code change that neither fixes a bug nor adds a feature)
- [ ] ⚡ Performance (changes that improve performance)
- [ ] 🛠️ Chore (changes to build process, dependencies, etc.)

**Related Issues:**
- Closes #[issue number]
- Related to #[issue number]

---

## 🧪 Testing

<!-- Describe how you tested your changes -->

**Testing Checklist:**
- [ ] Unit tests pass (`npm test`)
- [ ] Type checking passes (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Integration tests pass (`npm run integration:check`)
- [ ] Tested in simulation mode (if applicable)
- [ ] Tested with real API endpoints (if applicable)
- [ ] Manual testing completed
- [ ] Browser testing (if UI changes)

**Test Coverage:**
<!-- Describe test coverage for new code -->
- [ ] New code is covered by tests
- [ ] Existing tests still pass
- [ ] Test coverage remains above threshold

---

## 🔒 Security Checklist

**Security Review:**
- [ ] No secrets or API keys committed
- [ ] No sensitive data exposed in logs
- [ ] Authentication/authorization properly implemented (if applicable)
- [ ] Input validation implemented for new endpoints
- [ ] SQL injection prevention measures in place (if applicable)
- [ ] XSS prevention measures in place (if applicable)
- [ ] HTTPS enforced for sensitive operations
- [ ] Feature flags configured for gradual rollout
- [ ] Security impact assessed and documented

**Configuration Safety:**
- [ ] Environment variables properly configured
- [ ] Default values are secure
- [ ] Configuration validated with `npm run config:lint`
- [ ] No hardcoded URLs or configuration in source code

---

## 🚀 Deployment Safety

**Pre-deployment Checklist:**
- [ ] Changes are backward compatible
- [ ] Database migrations are reversible (if applicable)
- [ ] Feature flags are used for new functionality
- [ ] Rollback plan documented
- [ ] Monitoring/alerting updated for new features
- [ ] Documentation updated (README, API docs, etc.)

**Performance Impact:**
- [ ] Performance impact assessed
- [ ] No significant performance regression
- [ ] Load testing performed (if significant changes)
- [ ] Resource usage considered (CPU, memory, storage)

**Rollout Strategy:**
- [ ] Feature flag controlled rollout planned
- [ ] Staged deployment to staging → production
- [ ] Monitoring plan for post-deployment
- [ ] Team notified of deployment schedule

---

## 📖 Documentation

**Documentation Updates:**
- [ ] API documentation updated (if API changes)
- [ ] README updated (if user-facing changes)
- [ ] Operator handbook updated (if operational changes)
- [ ] Code comments added for complex logic
- [ ] Migration guide provided (if breaking changes)

**Code Quality:**
- [ ] Code follows project conventions
- [ ] Complex logic is well-commented
- [ ] Error handling is comprehensive
- [ ] Logging is appropriate and helpful

---

## 🔍 Code Review Guide

**For Reviewers:**

Please check the following areas:

1. **Logic & Functionality**
   - Does the code do what it's supposed to do?
   - Are edge cases handled properly?
   - Is error handling comprehensive?

2. **Security**
   - Are there any security vulnerabilities?
   - Is user input properly validated?
   - Are secrets properly handled?

3. **Performance**
   - Are there any performance bottlenecks?
   - Is the database usage efficient?
   - Are there any memory leaks?

4. **Maintainability**
   - Is the code readable and well-organized?
   - Are there adequate tests?
   - Is the code following project patterns?

5. **Safety**
   - Can this change be safely rolled back?
   - Are feature flags used appropriately?
   - Is the deployment plan sound?

---

## 📝 Additional Notes

<!-- Any additional information for reviewers -->

**Breaking Changes:**
<!-- If this is a breaking change, document what breaks and how to migrate -->

**Dependencies:**
<!-- List any new dependencies or changes to existing ones -->

**Configuration Changes:**
<!-- Document any required configuration changes -->

**Migration Steps:**
<!-- Document any manual steps required for deployment -->

---

## 📋 Pre-submission Checklist

- [ ] I have read the [CONTRIBUTING.md](./CONTRIBUTING.md) guidelines
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged and published
- [ ] I have checked my code for security vulnerabilities
- [ ] I have verified that sensitive information is not included

---

**Reviewer Assignment:**
- @platform-team (for platform/infrastructure changes)
- @security-team (for security-related changes)
- @frontend-team (for UI changes)
- @backend-team (for API changes)

**Additional Context:**
<!-- Add any additional context, screenshots, or information that would be helpful for reviewers -->