import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The specific user ID we're creating meetings for
const userId = '502f7932-1bca-448d-a9d1-a446c4d91bbb';

// Create a mix of good and bad meetings
async function main() {
  console.log(`Seeding 10 meetings for user ID: ${userId}`);
  
  // First, let's verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    console.error(`User with ID ${userId} not found!`);
    return;
  }
  
  console.log(`Found user: ${user.name} (${user.email})`);
  
  // Delete any existing meetings for this user (clean slate)
  const deleted = await prisma.meeting.deleteMany({
    where: { createdBy: userId }
  });
  
  console.log(`Deleted ${deleted.count} existing meetings`);
  
  // Create 10 meetings with varying attributes
  const meetings = [
    // Good performance one-on-ones (positive outcomes)
    {
      title: "1:1 Meeting - May 2nd",
      teamMemberId: userId, // Self-meeting for demo purposes
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Alex had an exceptional month with significant progress on all key projects. Performance continues to exceed expectations. Strong technical leadership demonstrated in the API migration project, with team members specifically praising Alex's mentorship. Client satisfaction metrics from the Henderson project were the highest we've seen this year.",
      wins: [
        "Completed API migration project 2 weeks ahead of schedule, saving an estimated 120 developer hours",
        "Received perfect 10/10 client satisfaction score on Henderson account deliverables",
        "Successfully mentored two junior developers who are now contributing independently",
        "Automated deployment pipeline, reducing release time from 3 hours to 20 minutes",
        "Identified and fixed critical security vulnerability before it impacted production",
        "Improved code coverage metrics from 72% to 94% across all managed repositories",
        "Implemented new documentation approach praised by cross-functional teams",
        "Represented company at tech conference, resulting in 3 new potential client leads"
      ],
      areasForSupport: [
        "Consider delegating more routine code reviews to create space for strategic work",
        "Work-life balance still needs attention - logged over 50 hours several weeks this month",
        "Would benefit from additional leadership training as team continues to grow",
        "Cross-functional communication with Design team could be improved",
        "Public speaking confidence - preparation for upcoming conference talk",
        "More structured approach to mentoring junior team members needed",
        "Time management during peak delivery periods"
      ],
      actionItems: [
        "Schedule enrollment in Advanced Leadership course by next week",
        "Begin 1:1 mentoring sessions with Design Lead to improve cross-department collaboration",
        "Create delegation plan for code reviews to senior developers",
        "Block calendar for non-work hours to improve work-life balance",
        "Submit proposal for conference speaking engagement by end of next month",
        "Set up biweekly check-ins with junior developers to continue mentorship",
        "Draft career progression plan for next 18 months",
        "Research time management techniques for engineering leaders"
      ],
      transcript: "This was an exceptionally positive one-on-one meeting focusing on Alex's continued strong performance. We discussed the significant wins across technical delivery, mentorship, and client satisfaction. Alex expressed appreciation for the recognition but also raised concerns about sustainable pace and work-life balance. We agreed on several action items including delegation strategies and leadership development opportunities. Alex remains on track for promotion consideration at year-end review.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - May 16th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45), // 45 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Alex continues to perform at an outstanding level. This period saw exceptional results in both technical delivery and team leadership. The load-testing initiative Alex championed has already prevented two potential production incidents. Work-life balance has improved significantly following our action items from last meeting.",
      wins: [
        "Successfully launched v2 of customer dashboard with zero reported bugs in first week",
        "Load-testing initiative identified and prevented two potential production incidents",
        "Work-life balance improved with average work week reduced to 42 hours (down from 52)",
        "Mentorship program formalized with documented process now used by 3 other team leads",
        "Client presentation resulted in $200K contract extension",
        "Improved API response times by 42% through cache optimization",
        "Knowledge-sharing sessions received average rating of 4.8/5 from attendees",
        "Technical blog post published, driving 15K visitors to company website"
      ],
      areasForSupport: [
        "Strategic planning skills could be further developed for larger, multi-quarter initiatives",
        "Occasional tendency to perfect solutions beyond diminishing returns point",
        "Could benefit from more experience with budget management aspects of projects",
        "Stakeholder management for the upcoming multi-team project will be challenging",
        "More comfort needed with ambiguity in early-stage projects",
        "Finding balance between technical excellence and pragmatic solutions",
        "Scaling influence beyond immediate team"
      ],
      actionItems: [
        "Schedule time with VP of Engineering to shadow strategic planning process",
        "Identify training opportunity for budget management and resource allocation",
        "Define 'good enough' metrics for current projects to avoid over-optimization",
        "Create stakeholder communication plan for upcoming multi-team project",
        "Set up bi-weekly cross-functional team lunches to improve collaboration",
        "Review career progression plan and update with focus on strategic leadership",
        "Schedule session with experienced product manager to develop comfort with ambiguous requirements",
        "Create decision framework for determining appropriate solution complexity"
      ],
      transcript: "Our mid-May review continued to reflect Alex's strong performance trajectory. We celebrated significant wins in both technical implementation and growing leadership skills. The work-life balance improvements were particularly notable after our discussions last month. Alex is showing great progress in delegation and team enablement. We agreed on several new action items focused on strategic planning, stakeholder management, and developing comfort with ambiguity, which will be important for the upcoming multi-team project Alex will be leading.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - May 30th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Excellent progress on all fronts this period. Alex has successfully implemented several of the action items from our previous discussions, with notable improvements in delegation and cross-team collaboration. The strategic planning shadowing has already yielded benefits in how Alex structures the upcoming fintech integration work.",
      wins: [
        "Delegation plan fully implemented, freeing 8+ hours weekly for strategic work",
        "Cross-functional collaboration workshop received outstanding feedback from Design team",
        "Successfully completed shadowing with VP of Engineering on strategic planning",
        "Proposed architectural approach for fintech integration approved by leadership",
        "Mentoring program expanded to 3 additional junior developers with positive feedback",
        "Work-life balance metrics maintained at healthy levels throughout month",
        "Open source contribution accepted to key industry project",
        "Team velocity increased 18% while maintaining quality standards"
      ],
      areasForSupport: [
        "Balancing innovation with maintenance responsibilities",
        "Scaling influence to the broader organization beyond immediate teams",
        "Handling competing priorities from multiple stakeholders",
        "Building effective relationships with new leadership team members",
        "Creating space for deeper technical exploration while handling management duties",
        "Finding opportunities for external visibility and industry recognition",
        "Developing executive communication skills for senior leadership presentations"
      ],
      actionItems: [
        "Create innovation/maintenance weekly time allocation framework",
        "Schedule 1:1 coffee chats with key stakeholders outside direct reporting line",
        "Develop stakeholder prioritization matrix for managing competing demands",
        "Create 30-60-90 day plan for fintech integration leadership",
        "Block 4 hours weekly for dedicated technical depth work",
        "Identify speaking or writing opportunity for industry thought leadership",
        "Prepare executive summary template for senior leadership communications",
        "Review Q3 goals and align with recently clarified company objectives"
      ],
      transcript: "Our end-of-May review highlighted Alex's continued strong trajectory and effective implementation of previous action items. The delegation strategy has been particularly successful, creating needed space for strategic work. We discussed how to maintain this positive momentum while preparing for the significant challenges of the upcoming fintech integration project. Alex expressed enthusiasm about the leadership shadowing experience and has already incorporated learnings into planning approaches. We agreed on action items focused on balancing innovation with maintenance, scaling organizational influence, and developing executive communication skills.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - June 13th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15), // 15 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Strong performance continues with significant progress on strategic initiatives. Alex has successfully launched the developer excellence program that's now being adopted across multiple teams. Executive communication skills showing marked improvement, with positive feedback from leadership on recent presentations. Work-life balance remains healthy.",
      wins: [
        "Developer excellence program successfully launched and adopted by 3 teams",
        "Executive presentation on fintech integration architecture highly praised by leadership",
        "Successfully mentored junior developer to promotion-ready status",
        "Implemented stakeholder prioritization framework reducing conflicting demands by 40%",
        "Innovation time resulted in prototype tool now in pilot with 2 teams",
        "External blog post reached #1 on Hacker News, driving significant company visibility",
        "Code quality metrics show 22% improvement across repositories Alex oversees",
        "Successfully negotiated additional resources for fintech integration project"
      ],
      areasForSupport: [
        "Managing expectations with enthusiastic stakeholders who request scope expansions",
        "Developing comfort with delegating critical path items to recently promoted developers",
        "Balancing immediate delivery pressures with technical debt management",
        "Scaling technical oversight as area of responsibility grows",
        "Creating opportunities for quiet team members to have impact and visibility",
        "Establishing appropriate boundaries with adjacent teams requiring assistance",
        "Fostering innovation culture within tight delivery timelines"
      ],
      actionItems: [
        "Document scope management and change request process for stakeholders",
        "Create progressive delegation plan for critical path items with appropriate guardrails",
        "Schedule quarterly technical debt review and prioritization session",
        "Develop technical oversight strategy that scales with growing responsibilities",
        "Create team contribution framework that accommodates different work styles",
        "Document and communicate support boundaries for adjacent teams",
        "Implement innovation time structure with lightweight process",
        "Begin preparation for end-of-quarter performance summary"
      ],
      transcript: "Our mid-June 1:1 focused on Alex's continued strong performance and the positive reception of several key initiatives. The developer excellence program has been particularly successful, with multiple teams now adopting the practices Alex pioneered. We discussed strategies for maintaining this momentum while ensuring appropriate boundaries and sustainable practices. The executive presentation was a significant milestone, with leadership specifically noting Alex's ability to connect technical details to business outcomes. We agreed on action items centered around scale, delegation, and creating structure that enables both innovation and reliable delivery.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - June 27th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "End of quarter review showing outstanding performance across all key metrics. Alex has successfully addressed previous development areas and is now consistently operating at a level above current role expectations. The fintech integration kick-off was executed flawlessly with all stakeholders aligned. Career progression discussion indicates readiness for advancement consideration in the next cycle.",
      wins: [
        "Fintech integration project successfully kicked off with 100% stakeholder alignment",
        "Team effectiveness metrics show 30% improvement since implementing Alex's delegation framework",
        "Successfully completed advanced leadership certification program",
        "Technical architecture proposal accepted without changes by architecture review board",
        "Innovation time project now formally approved for full development",
        "All Q2 OKRs achieved at 90%+ completion levels",
        "Mentored developers all reporting high satisfaction and rapid growth",
        "Speaker proposal accepted for industry conference keynote"
      ],
      areasForSupport: [
        "Preparing for the increased visibility and expectations of senior technical role",
        "Building broader cross-organizational relationships beyond current sphere",
        "Developing skills for influencing without authority in matrix organization",
        "Maintaining technical depth while expanding leadership breadth",
        "Creating space for strategic thinking in increasingly busy calendar",
        "Cultivating executive sponsorship for promotion consideration",
        "Balancing advocacy for team with organizational alignment"
      ],
      actionItems: [
        "Submit draft promotion document for initial feedback",
        "Schedule monthly cross-department lunches to build broader relationships",
        "Enroll in influence without authority workshop scheduled for next month",
        "Create technical depth maintenance plan with dedicated learning time",
        "Implement 'strategy Wednesday' with first 2 hours blocked for thinking work",
        "Prepare impact summary for executive review session",
        "Develop team advocacy and organizational alignment framework",
        "Finalize Q3 OKRs with increased emphasis on organizational impact"
      ],
      transcript: "Our end-of-quarter review reflected Alex's exceptional performance and growth over the past three months. We reviewed Q2 accomplishments against OKRs, noting the consistently high achievement levels. The fintech integration kickoff demonstrated Alex's growing strategic leadership capabilities, and received praise from senior stakeholders. We spent significant time discussing career progression, as Alex is now regularly performing at a level consistent with the senior technical role. We outlined specific actions to prepare for promotion consideration in the next cycle, with emphasis on broader organizational impact and executive visibility. Alex expressed enthusiasm about taking on increasingly strategic responsibilities while maintaining technical excellence.",
      createdBy: userId
    },
    
    // Performance improvement needed one-on-ones
    {
      title: "1:1 Meeting - February 15th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 135), // 135 days ago
      duration: 75,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Critical discussion regarding recent performance concerns. Alex has missed several deadlines and quality issues have been reported in recent deliverables. This represents a significant departure from previously strong performance. Discussion revealed personal challenges and burnout symptoms. Created structured performance improvement plan with clear expectations and support resources.",
      wins: [
        "Open and honest communication about performance challenges",
        "Clear acknowledgment of issues without defensiveness",
        "Thoughtful self-reflection on contributing factors",
        "Proactive suggestions for improvement measures",
        "Identified specific areas where support is needed",
        "Outlined reasonable timeline for addressing issues",
        "Recognition of impact on team and client relationships",
        "Commitment to specific improvement actions"
      ],
      areasForSupport: [
        "Meeting deadlines consistently - last 3 deliverables were 2-5 days late",
        "Code quality has declined with 32% increase in reported bugs",
        "Communication with stakeholders has been irregular and sometimes missed",
        "Documentation increasingly incomplete or outdated",
        "Signs of burnout affecting engagement and attention to detail",
        "Time management challenges affecting multiple workstreams",
        "Technical debt accumulating in recent contributions",
        "Reduced participation in team discussions and planning sessions"
      ],
      actionItems: [
        "Create 30-60-90 day performance improvement plan with weekly checkpoints",
        "Schedule session with HR to discuss short-term accommodations and support options",
        "Implement daily end-of-day progress updates for visibility",
        "Temporarily reduce project load to focus on quality over quantity",
        "Set up peer code review buddy system for additional quality checks",
        "Establish clear, documented expectations for each current deliverable",
        "Schedule time with mental health resource through employee assistance program",
        "Create detailed time management plan with dedicated focus blocks"
      ],
      transcript: "This was a difficult but necessary conversation about Alex's recent performance decline. What made the discussion productive was Alex's openness and lack of defensiveness. We identified several factors contributing to the situation, including some personal challenges, burnout symptoms, and workload management issues. Rather than focusing solely on the problems, we collaborated on a structured improvement plan with clear expectations and appropriate support. Alex expressed genuine commitment to returning to previous high performance levels. We'll have weekly check-ins to monitor progress against specific metrics and adjust the support approach as needed.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - March 1st",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 120), // 120 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Two-week check-in on Alex's performance improvement plan. Seeing early positive indicators in some areas, particularly in communication reliability and daily updates. Quality is showing improvement though still inconsistent. Deadlines remain challenging but Alex is now communicating risks earlier. Overall showing commitment to improvement but still requiring significant support.",
      wins: [
        "Daily updates consistently provided with appropriate detail",
        "Stakeholder communication has improved in frequency and clarity",
        "Successfully delivered one project component on time with acceptable quality",
        "Actively participating in code reviews and team discussions again",
        "Completed first session with EAP resources for stress management",
        "Time management plan implemented with visible improvement in focus",
        "Proactively escalated potential blockers before they impacted timeline",
        "Documentation quality showing improvement in recent submissions"
      ],
      areasForSupport: [
        "Delivery quality still inconsistent across different components",
        "Estimated completion times still frequently overoptimistic",
        "Technical debt from previous period largely unaddressed",
        "Energy levels fluctuating significantly throughout the workweek",
        "Detailed planning still requiring significant oversight and guidance",
        "Difficulty prioritizing between competing urgent demands",
        "Follow-through on complex multi-step tasks occasionally incomplete",
        "Still working excessive hours despite reduced workload"
      ],
      actionItems: [
        "Implement standard quality checklist for all deliverables",
        "Create estimation worksheet with built-in buffer for different task types",
        "Schedule dedicated technical debt reduction session for next sprint",
        "Develop energy management strategy with HR wellness coach",
        "Set up daily 15-minute planning session with team lead",
        "Document prioritization framework for managing competing demands",
        "Implement task breakdown process for all complex deliverables",
        "Enforce strict working hours with system shutdown at 6pm"
      ],
      transcript: "This two-week check-in on Alex's performance improvement plan showed some encouraging early signs alongside areas needing continued focus. Communication has improved significantly, with daily updates and stakeholder communications now reliable and clear. Quality and estimation accuracy continue to need attention, with inconsistent results across different work types. We discussed the continued signs of burnout despite reduced workload, and agreed on stricter boundaries for working hours. Alex shared that the EAP resources have been helpful but that building sustainable practices will take time. We adjusted the improvement plan to include more structured planning support and formalized quality checks.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - March 15th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 105), // 105 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "One-month check-in on Alex's performance improvement plan. Seeing consistent progress across most areas, particularly in quality control and communication reliability. Deadline accuracy improving through better estimation practices. Work-life boundaries now consistently maintained. Still some challenges with complex task management and technical debt, but overall trajectory is clearly positive.",
      wins: [
        "All deliverables in past two weeks met quality standards",
        "Estimation accuracy improved to within 15% of actual time required",
        "Consistent adherence to work hour boundaries with 6pm system shutdown",
        "Technical debt reduction session successfully completed with measurable improvements",
        "Daily planning sessions resulting in more structured and achievable daily goals",
        "Documentation consistently thorough and up-to-date",
        "Proactive stakeholder updates now standard practice",
        "Energy level and engagement noticeably more consistent"
      ],
      areasForSupport: [
        "Complex task breakdown still occasionally missing important sub-components",
        "Technical debt from previous periods partially addressed but significant work remains",
        "Confidence in abilities still rebuilding after difficult period",
        "Bandwidth for mentoring others not yet restored to previous levels",
        "Dependency management across team boundaries still challenging",
        "Prioritization framework needs refinement for edge cases",
        "Occasional reversion to old patterns under unexpected pressure"
      ],
      actionItems: [
        "Create complex task template with common sub-component checklist",
        "Schedule monthly technical debt reduction days for Q2",
        "Assign small mentoring opportunity to rebuild confidence",
        "Review and refine dependency management process with adjacent teams",
        "Workshop prioritization framework with team for edge case handling",
        "Document stress triggers and mitigation strategies",
        "Begin reducing direct oversight while maintaining daily check-ins",
        "Prepare for transition to bi-weekly improvement plan check-ins"
      ],
      transcript: "Our one-month review of Alex's performance improvement plan showed substantial progress across all key areas. Quality has returned to expected standards, and the estimation accuracy has improved dramatically through the structured worksheet approach. We both noted the positive impact of consistent work-hour boundaries on energy levels and focus quality. Alex shared that the daily planning sessions have been particularly helpful in breaking down complex work into manageable components, though some challenges remain with very complex tasks. The EAP support has provided useful strategies for stress management that Alex is actively implementing. We agreed that the progress warrants reducing direct oversight while maintaining daily check-ins, and planning for a transition to bi-weekly formal reviews of the improvement plan.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - March 29th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Six-week review of Alex's performance improvement plan. Substantial progress continues across all areas of focus. Quality and reliability metrics now consistently meeting or exceeding team standards. Work-life balance successfully maintained even during high-pressure deliverables. Technical debt significantly reduced, and confidence visibly rebuilding. Ready to transition to bi-weekly check-ins.",
      wins: [
        "Consistently meeting or exceeding quality standards across all deliverables",
        "Estimation accuracy now within 10% of actual time required",
        "Successfully led technical debt reduction initiative with measurable outcomes",
        "Maintained healthy work-life boundaries even during critical release",
        "Complex task management showing significant improvement with new template",
        "Returned to mentoring junior developer with positive feedback",
        "Stakeholder communications proactive and comprehensive",
        "Team members noting positive impact of Alex's renewed engagement"
      ],
      areasForSupport: [
        "Continuing to build confidence in high-visibility situations",
        "Maintaining improvements during periods of increased pressure",
        "Finding appropriate opportunities to restore broader organizational visibility",
        "Building resilience against potential future burnout triggers",
        "Appropriate scaling of responsibilities as improvement continues",
        "Long-term technical debt management strategy",
        "Creating sustainable documentation practices as workload increases"
      ],
      actionItems: [
        "Transition to bi-weekly formal improvement plan check-ins",
        "Identify appropriate high-visibility opportunity to rebuild organizational profile",
        "Document personal burnout indicators and preemptive mitigation strategies",
        "Create progressive responsibility restoration roadmap for Q2",
        "Schedule technical showcase presentation for upcoming all-hands",
        "Develop sustainable technical debt management strategy",
        "Begin discussions about Q3 goals and focus areas",
        "Document learnings from improvement process for personal reference"
      ],
      transcript: "Our six-week review demonstrated substantial and consistent progress across all performance areas. Alex has successfully restored quality standards and reliability while maintaining healthy work-life boundaries. Particularly impressive has been the leadership in technical debt reduction and the return to mentoring activities. We discussed the transition to less intensive oversight, with bi-weekly formal check-ins replacing the weekly cadence. Alex expressed appreciation for the structured support and shared several insights about personal workstyle and stress management that will be valuable for preventing similar situations in the future. We outlined a plan for gradually restoring additional responsibilities and visibility opportunities, with careful attention to maintaining the sustainable practices that have been established.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - April 20th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 70), // 70 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Two-month formal review of performance improvement plan. Alex has successfully addressed all original performance concerns and is now consistently operating at or above expected standards. Performance improvement plan formally concluded with transition to regular management cadence. Valuable insights gained about sustainable high performance and early intervention strategies.",
      wins: [
        "All performance metrics consistently meeting or exceeding standards for past month",
        "Successfully led cross-team initiative with high visibility and positive feedback",
        "Technical debt in primary codebase reduced by 40% through systematic approach",
        "Mentoring relationship with junior developer yielding measurable productivity gains",
        "Maintained consistent work-life boundaries through varying pressure periods",
        "Complex task management now a strength with documented methodology",
        "Restored positive reputation with key stakeholders through reliable delivery",
        "Technical showcase at all-hands received excellent feedback"
      ],
      areasForSupport: [
        "Sustaining improvements while gradually increasing responsibility scope",
        "Continuing to build resilience against identified burnout triggers",
        "Re-establishing strategic career progression after stabilization period",
        "Balancing growing mentoring requests with core responsibilities",
        "Finding appropriate growth challenges that don't risk regression",
        "Communicating performance journey appropriately during promotion discussions",
        "Maintaining quality documentation practices as pace increases"
      ],
      actionItems: [
        "Formally conclude performance improvement plan",
        "Return to regular bi-weekly 1:1 schedule",
        "Update career development plan incorporating recent insights",
        "Schedule quarterly check-in specifically focused on work-life sustainability",
        "Document personal best practices for maintaining high performance",
        "Create guidelines for evaluating new responsibility opportunities",
        "Schedule discussion with HR about appropriate performance journey narrative",
        "Select next significant growth challenge with appropriate support"
      ],
      transcript: "This two-month review marked the successful completion of Alex's performance improvement plan. All initial areas of concern have been consistently addressed, with performance now at or above expected standards across all metrics. We discussed the valuable insights gained through this challenging period, particularly around sustainable high performance practices and early warning signs of burnout. Alex has not only returned to previous performance levels but has developed improved approaches to complex task management and technical debt reduction that will serve well going forward. We formally concluded the improvement plan and will return to our regular management cadence, with continued attention to sustainability practices and strategic career development.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - July 3rd",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25), // 25 days ago
      duration: 45,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Quarterly goal setting and review session. Discussed Alex's exceptional performance since recovery and established ambitious but achievable Q3 objectives. Significant focus on long-term career progression toward technical leadership role. Alex continues to maintain excellent balance of high performance and sustainable practices.",
      wins: [
        "Exceeded all Q2 goals with measurable impact on team productivity metrics",
        "Technical leadership on authentication system redesign praised by senior leadership",
        "Mentorship program formalized and adopted by Engineering department",
        "Developed and presented architectural vision accepted for next-gen platform",
        "Collaboration framework with Design team yielded 40% reduction in rework",
        "External recognition through industry blog publication and conference acceptance",
        "Maintained consistent work-life balance while increasing strategic impact",
        "Feedback from cross-functional stakeholders unanimously positive"
      ],
      areasForSupport: [
        "Expanded scope of architectural responsibility requires broader system knowledge",
        "Influence at executive level needs development for strategic initiatives",
        "Balancing individual technical contributions with growing leadership expectations",
        "Managing increased demands on time as visibility and impact grow",
        "Developing skills for larger team technical leadership beyond current scope",
        "Building strategic partnerships with Product and Business stakeholders",
        "Adapting communication style for different organizational audiences"
      ],
      actionItems: [
        "Schedule system architecture review sessions for adjacent domains",
        "Shadow CTO in monthly business strategy sessions",
        "Create time allocation framework for technical contribution vs. leadership activities",
        "Implement upgraded calendar management system with clear boundaries",
        "Sign up for technical leadership cohort starting in August",
        "Schedule regular coffee chats with Product and Business leadership",
        "Develop communication templates for different organizational audiences",
        "Draft promotion document for end-of-year consideration"
      ],
      transcript: "Our quarterly planning session reflected on Alex's continued excellent trajectory since successfully completing the performance improvement plan. We celebrated the substantial achievements from Q2 and discussed how these position Alex well for the senior technical leadership track. The learnings from the challenging period earlier in the year have clearly translated into more sustainable high-performance practices, which Alex is now sharing with others through the formalized mentorship program. We established ambitious but achievable Q3 objectives with emphasis on growing architectural influence and cross-functional leadership. The action items focus on building necessary skills and relationships for the next career level, with particular attention to executive influence and broader organizational impact.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - July 10th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18), // 18 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Follow-up session focused on preparing for the fintech integration project leadership. Alex will be leading this strategic, high-visibility initiative starting next month. Discussed team composition, stakeholder management strategy, and technical approach. Alex is well-positioned for success but will need support managing the cross-organizational complexity.",
      wins: [
        "Architectural approach for fintech integration approved unanimously by review board",
        "Effectively negotiated with department heads for required team resources",
        "Created comprehensive risk assessment that executive team praised for thoroughness",
        "Pre-work technical spike successfully validated key assumptions",
        "Onboarding plan for team members received positive feedback from HR",
        "Security review completed with all high-priority recommendations addressed",
        "Stakeholder communication plan comprehensive and well-received",
        "Demonstrated excellent understanding of business objectives beyond technical concerns"
      ],
      areasForSupport: [
        "Limited previous experience managing project of this scale and visibility",
        "Complex stakeholder landscape includes some challenging personalities",
        "Regulatory compliance aspects require specialized knowledge",
        "Integration with legacy financial systems presents unknown technical challenges",
        "Team will include members from five different departments with varying priorities",
        "Project timelines aggressive given known constraints",
        "Executive reporting and communication cadence differs from previous experience",
        "Critical nature of financial data requires exceptional quality controls"
      ],
      actionItems: [
        "Schedule shadowing session with PMO director for large-scale project insights",
        "Set up background meetings with each key stakeholder before kickoff",
        "Arrange specialized training on financial regulatory requirements",
        "Create technical spike tasks to assess legacy system integration challenges",
        "Develop team charter addressing cross-departmental collaboration model",
        "Revise timeline with appropriate buffers for known risk areas",
        "Create executive dashboard template with communication lead",
        "Document enhanced quality control process for financial data handling"
      ],
      transcript: "This session focused on preparation for the upcoming fintech integration project that Alex will be leading. The project represents a significant step up in terms of scale, visibility, and cross-organizational complexity. We reviewed the impressive pre-work Alex has already completed, particularly the architectural approach and risk assessment. The discussion centered on identifying areas where additional preparation would be beneficial, especially around stakeholder management and regulatory requirements. Alex expressed both excitement about the opportunity and appropriate concern about the challenges. We developed a comprehensive preparation plan for the weeks leading up to the formal kickoff. This project will provide excellent visibility and growth opportunity aligned with Alex's career progression toward senior technical leadership.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - July 25th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Final preparation review before fintech integration project kickoff. Alex has completed all readiness activities and is well-prepared to lead this strategic initiative. Stakeholder relationships established, team onboarding plan ready, and technical approach fully validated. Discussed communication strategy and escalation paths for potential challenges.",
      wins: [
        "Completed one-on-one meetings with all 12 key stakeholders",
        "Technical spike results validated approach and identified mitigation strategies for risks",
        "Team charter created with input from all participating departments",
        "Regulatory training completed with certification",
        "Executive dashboard prototype approved by leadership team",
        "Quality control process enhanced specifically for financial data requirements",
        "Resource plan approved with appropriate buffers for identified risk areas",
        "Project plan and timeline reviewed and endorsed by PMO"
      ],
      areasForSupport: [
        "Managing scope creep from enthusiastic business stakeholders",
        "Balancing aggressive timeline with appropriate quality controls",
        "Navigating competing priorities between security, performance, and feature requirements",
        "Maintaining team cohesion across departmental boundaries",
        "Adapting to changing market requirements during extended project timeline",
        "Managing executive visibility while protecting team from disruption",
        "Ensuring technical decisions account for long-term architecture vision",
        "Personal sustainability given high-stakes and visibility of project"
      ],
      actionItems: [
        "Finalize scope change control process before kickoff",
        "Create weekly quality metrics dashboard for transparent tracking",
        "Develop decision framework for security/performance/feature tradeoffs",
        "Schedule recurring team building activities throughout project timeline",
        "Establish monthly requirement review process with business stakeholders",
        "Create communication buffer strategy for managing executive inquiries",
        "Document architecture decision records with long-term vision context",
        "Schedule regular personal check-ins focused on sustainability"
      ],
      transcript: "Our final preparation review before the fintech integration kickoff confirmed that Alex has completed all readiness activities and is exceptionally well-prepared to lead this strategic initiative. The pre-work has been thorough, with stakeholder relationships established, team structures defined, and technical approach validated through concrete prototyping. We identified potential challenges around scope management and competing priorities, and established clear processes to address these proactively. Alex has demonstrated impressive leadership in bringing together cross-functional perspectives and creating a unified approach. We discussed the importance of maintaining personal sustainability practices given the high visibility and pressure of this project. Alex expressed confidence in the preparation while maintaining appropriate caution about the complexity ahead.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - August 3rd",
      teamMemberId: userId,
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days in future
      duration: 60,
      status: "scheduled",
      processingStatus: "pending",
      meetingType: "one_on_one",
      googleMeetLink: "https://meet.google.com/abc-defg-hij",
      createdBy: userId,
      wins: [],
      areasForSupport: [],
      actionItems: []
    }
  ];
  
  // Insert the meetings
  for (const meeting of meetings) {
    await prisma.meeting.create({
      data: meeting
    });
    console.log(`Created meeting: ${meeting.title}`);
  }
  
  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 