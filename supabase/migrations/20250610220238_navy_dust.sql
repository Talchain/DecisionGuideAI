/*
  # Add Product Team Criteria Templates

  1. New Data
    - Insert 10 predefined criteria templates optimized for product teams
    - Templates cover common scenarios: feature prioritization, roadmap planning, 
      go/no-go decisions, vendor selection, hiring, experiments, investments, 
      customer problems, risk assessment, and retrospectives
    
  2. Template Structure
    - Each template has a name, description, type, and criteria array
    - Criteria include name, weight, and optional tooltip for guidance
    - Templates are categorized by decision type for better filtering
*/

-- Insert product team criteria templates
INSERT INTO public.criteria_templates (name, description, type, criteria) VALUES
(
  'Feature Prioritization',
  'Evaluate and rank new features for your product roadmap.',
  'professional',
  '[
    {"id": "fp-1", "name": "User Value / Impact", "weight": 5, "tooltip": "How much value does this feature provide to users?"},
    {"id": "fp-2", "name": "Effort / Cost", "weight": 4, "tooltip": "Development time, resources, and complexity required"},
    {"id": "fp-3", "name": "Strategic Fit", "weight": 4, "tooltip": "Alignment with company strategy and product vision"},
    {"id": "fp-4", "name": "Risk", "weight": 3, "tooltip": "Technical, market, or execution risks involved"},
    {"id": "fp-5", "name": "Time to Deliver", "weight": 3, "tooltip": "Speed of implementation and time to market"},
    {"id": "fp-6", "name": "Differentiation", "weight": 4, "tooltip": "Competitive advantage and uniqueness"},
    {"id": "fp-7", "name": "Technical Feasibility", "weight": 3, "tooltip": "Technical complexity and implementation challenges"}
  ]'::jsonb
),
(
  'Roadmap Planning / Quarterly Planning',
  'Plan and prioritize initiatives for upcoming quarters.',
  'professional',
  '[
    {"id": "rp-1", "name": "Strategic Alignment", "weight": 5, "tooltip": "How well does this align with company OKRs?"},
    {"id": "rp-2", "name": "Resource Availability", "weight": 4, "tooltip": "Do we have the right people and skills?"},
    {"id": "rp-3", "name": "Customer Demand", "weight": 5, "tooltip": "Level of customer need and market pull"},
    {"id": "rp-4", "name": "Dependencies", "weight": 3, "tooltip": "External dependencies and blockers"},
    {"id": "rp-5", "name": "Business Value", "weight": 5, "tooltip": "Expected revenue or business impact"},
    {"id": "rp-6", "name": "Urgency", "weight": 4, "tooltip": "Time sensitivity and market timing"},
    {"id": "rp-7", "name": "Confidence in Estimates", "weight": 3, "tooltip": "How confident are we in our planning?"}
  ]'::jsonb
),
(
  'Go/No-Go Launch Decision',
  'Decide whether to proceed with a product or feature launch.',
  'professional',
  '[
    {"id": "gng-1", "name": "Market Readiness", "weight": 5, "tooltip": "Is the market ready for this solution?"},
    {"id": "gng-2", "name": "Product Completeness", "weight": 4, "tooltip": "Feature completeness and quality level"},
    {"id": "gng-3", "name": "Customer Validation", "weight": 5, "tooltip": "Evidence of customer need and acceptance"},
    {"id": "gng-4", "name": "Technical Stability", "weight": 4, "tooltip": "System reliability and performance"},
    {"id": "gng-5", "name": "Compliance / Risk", "weight": 4, "tooltip": "Legal, security, and regulatory considerations"},
    {"id": "gng-6", "name": "Revenue Potential", "weight": 5, "tooltip": "Expected financial returns"},
    {"id": "gng-7", "name": "Team Readiness", "weight": 3, "tooltip": "Support, marketing, and operational readiness"}
  ]'::jsonb
),
(
  'Vendor/Tool Selection',
  'Evaluate and select vendors, tools, or third-party services.',
  'professional',
  '[
    {"id": "vts-1", "name": "Cost / ROI", "weight": 5, "tooltip": "Total cost of ownership and return on investment"},
    {"id": "vts-2", "name": "Reliability", "weight": 4, "tooltip": "Uptime, stability, and track record"},
    {"id": "vts-3", "name": "Integration Fit", "weight": 4, "tooltip": "How well does it integrate with existing systems?"},
    {"id": "vts-4", "name": "Support / Service", "weight": 4, "tooltip": "Quality of customer support and documentation"},
    {"id": "vts-5", "name": "Scalability", "weight": 4, "tooltip": "Ability to grow with our needs"},
    {"id": "vts-6", "name": "Security", "weight": 5, "tooltip": "Data protection and security features"},
    {"id": "vts-7", "name": "User Experience", "weight": 3, "tooltip": "Ease of use and adoption by team"}
  ]'::jsonb
),
(
  'Hiring or Team Expansion',
  'Evaluate candidates or decide on team structure changes.',
  'professional',
  '[
    {"id": "hte-1", "name": "Skills Fit", "weight": 5, "tooltip": "Technical and functional skills match"},
    {"id": "hte-2", "name": "Cultural Alignment", "weight": 4, "tooltip": "Fit with company values and culture"},
    {"id": "hte-3", "name": "Learning Potential", "weight": 4, "tooltip": "Growth mindset and adaptability"},
    {"id": "hte-4", "name": "Team Impact", "weight": 4, "tooltip": "Positive influence on team dynamics"},
    {"id": "hte-5", "name": "Experience Level", "weight": 3, "tooltip": "Relevant industry and role experience"},
    {"id": "hte-6", "name": "Communication / Collaboration", "weight": 4, "tooltip": "Ability to work effectively with others"},
    {"id": "hte-7", "name": "Availability", "weight": 3, "tooltip": "Timeline and commitment level"}
  ]'::jsonb
),
(
  'Experiment or Initiative Evaluation',
  'Assess experiments, pilots, or new initiatives before launch.',
  'professional',
  '[
    {"id": "eie-1", "name": "Hypothesis Clarity", "weight": 4, "tooltip": "Clear, testable hypothesis defined"},
    {"id": "eie-2", "name": "Learning Value", "weight": 5, "tooltip": "Potential insights and knowledge gained"},
    {"id": "eie-3", "name": "Cost / Effort", "weight": 4, "tooltip": "Resources required to execute"},
    {"id": "eie-4", "name": "Time to Insight", "weight": 4, "tooltip": "How quickly will we get results?"},
    {"id": "eie-5", "name": "Risk of Failure", "weight": 3, "tooltip": "Acceptable risk level and failure cost"},
    {"id": "eie-6", "name": "Scalability if Successful", "weight": 4, "tooltip": "Potential for broader application"},
    {"id": "eie-7", "name": "Alignment with OKRs", "weight": 4, "tooltip": "Connection to current objectives"}
  ]'::jsonb
),
(
  'Strategic Investment / Budget Allocation',
  'Decide on major investments or budget allocation across initiatives.',
  'financial',
  '[
    {"id": "siba-1", "name": "ROI Potential", "weight": 5, "tooltip": "Expected return on investment"},
    {"id": "siba-2", "name": "Strategic Fit", "weight": 5, "tooltip": "Alignment with long-term strategy"},
    {"id": "siba-3", "name": "Time to Value", "weight": 4, "tooltip": "How quickly will we see benefits?"},
    {"id": "siba-4", "name": "Risk", "weight": 4, "tooltip": "Financial and execution risks"},
    {"id": "siba-5", "name": "Opportunity Cost", "weight": 4, "tooltip": "What are we giving up by choosing this?"},
    {"id": "siba-6", "name": "Stakeholder Buy-in", "weight": 3, "tooltip": "Support from key stakeholders"},
    {"id": "siba-7", "name": "Long-term Impact", "weight": 5, "tooltip": "Sustainable competitive advantage"}
  ]'::jsonb
),
(
  'Customer Problem/Opportunity Assessment',
  'Evaluate customer problems or market opportunities to pursue.',
  'professional',
  '[
    {"id": "cpoa-1", "name": "Problem Frequency", "weight": 5, "tooltip": "How often do customers face this issue?"},
    {"id": "cpoa-2", "name": "User Pain Severity", "weight": 5, "tooltip": "Intensity of customer frustration"},
    {"id": "cpoa-3", "name": "Market Size", "weight": 4, "tooltip": "Total addressable market opportunity"},
    {"id": "cpoa-4", "name": "Willingness to Pay", "weight": 5, "tooltip": "Customer willingness to pay for solution"},
    {"id": "cpoa-5", "name": "Current Alternatives", "weight": 3, "tooltip": "Existing solutions and workarounds"},
    {"id": "cpoa-6", "name": "Strategic Importance", "weight": 4, "tooltip": "Importance to overall product strategy"},
    {"id": "cpoa-7", "name": "Ease of Solution", "weight": 3, "tooltip": "Technical feasibility of solving the problem"}
  ]'::jsonb
),
(
  'Risk Assessment / Mitigation Planning',
  'Assess and prioritize risks for mitigation planning.',
  'other',
  '[
    {"id": "ramp-1", "name": "Likelihood", "weight": 4, "tooltip": "Probability of the risk occurring"},
    {"id": "ramp-2", "name": "Impact / Severity", "weight": 5, "tooltip": "Potential damage if risk materializes"},
    {"id": "ramp-3", "name": "Detectability", "weight": 3, "tooltip": "How early can we detect this risk?"},
    {"id": "ramp-4", "name": "Mitigation Difficulty", "weight": 4, "tooltip": "Effort required to prevent or reduce risk"},
    {"id": "ramp-5", "name": "Recovery Time", "weight": 4, "tooltip": "Time needed to recover if risk occurs"},
    {"id": "ramp-6", "name": "Business Continuity", "weight": 5, "tooltip": "Impact on ongoing operations"},
    {"id": "ramp-7", "name": "Stakeholder Concern", "weight": 3, "tooltip": "Level of stakeholder worry about this risk"}
  ]'::jsonb
),
(
  'Retrospective or Post-Mortem Analysis',
  'Evaluate completed projects or initiatives for learning.',
  'other',
  '[
    {"id": "rpma-1", "name": "Goal Achievement", "weight": 5, "tooltip": "How well did we meet our objectives?"},
    {"id": "rpma-2", "name": "Successes", "weight": 4, "tooltip": "What worked well and should be repeated?"},
    {"id": "rpma-3", "name": "Failures / Obstacles", "weight": 4, "tooltip": "What didn''t work or blocked progress?"},
    {"id": "rpma-4", "name": "Root Cause", "weight": 4, "tooltip": "Understanding underlying causes of issues"},
    {"id": "rpma-5", "name": "Team Dynamics", "weight": 3, "tooltip": "How well did the team collaborate?"},
    {"id": "rpma-6", "name": "Process Issues", "weight": 3, "tooltip": "Problems with workflows or procedures"},
    {"id": "rpma-7", "name": "Lessons Learned", "weight": 5, "tooltip": "Key insights for future projects"}
  ]'::jsonb
);