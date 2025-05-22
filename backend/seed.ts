import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The specific user ID we're creating meetings for
const userId = 'b353730f-ea6f-4772-a9cf-cb86b273a3f0';

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
      title: "1:1 Meeting - April 5th",
      teamMemberId: userId, // Self-meeting for demo purposes
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 87), // 87 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan demonstrated outstanding performance this month, exceeding expectations across all key metrics. Technical leadership in the database migration project was exceptional, with team members highlighting Morgan's mentorship. Client feedback from the Vertex project was stellar, with specific praise for solution architecture and communication clarity.",
      wins: [
        "Successfully led database migration project, finishing 10 days ahead of schedule and under budget",
        "Received 9.8/10 client satisfaction score on Vertex project deliverables",
        "Mentored three junior developers who are now contributing to critical path work",
        "Implemented CI/CD improvements reducing deployment failures by 78%",
        "Led architecture review that identified and remediated potential scaling bottleneck",
        "Improved test coverage from 76% to 89% on core modules",
        "Developed technical specification template now adopted by entire engineering org",
        "Recognized in company all-hands for exceptional technical leadership"
      ],
      areasForSupport: [
        "Delegation skills could be improved - still taking on too much individual contributor work",
        "Work-life balance needs attention - averaged 52 hours per week this month",
        "Could benefit from more structured approach to cross-team collaboration",
        "Technical documentation sometimes assumes too much reader knowledge",
        "Preparation for upcoming technical presentations to leadership",
        "Time management during client-facing meetings could be more effective",
        "Balancing short-term delivery needs with long-term technical vision"
      ],
      actionItems: [
        "Create delegation plan for at least 20% of current technical workload by next week",
        "Block calendar for non-work hours to enforce better work-life balance",
        "Schedule shadowing with senior architect to observe cross-team collaboration techniques",
        "Review documentation with junior engineer to identify knowledge gaps",
        "Set up dry run for technical presentation with product team for feedback",
        "Implement meeting timeboxing strategy for client interactions",
        "Schedule quarterly technical roadmap review for long-term planning"
      ],
      transcript: "This meeting focused on Morgan's continued excellent performance and growth as a technical leader. We discussed the significant achievements in project delivery, team mentorship, and client satisfaction. Morgan expressed appreciation for the recognition but also acknowledged the need to address work-life balance and delegation challenges. We established concrete action items targeting these areas while maintaining momentum on technical leadership development. Morgan remains on track for promotion consideration in Q4.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - April 19th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 73), // 73 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan continues to excel in technical delivery and leadership. The new microservice architecture Morgan designed has been widely praised for its elegance and scalability. Significant progress was made on work-life balance with successful delegation of routine tasks. The mentoring program Morgan established is showing measurable results in junior developer productivity.",
      wins: [
        "Microservice architecture design received unanimous approval from architecture review board",
        "Successfully delegated 25% of routine tasks, exceeding our 20% target",
        "Work hours reduced to 45 per week average (down from 52) while maintaining productivity",
        "Structured mentoring program showing 32% productivity increase in junior team members",
        "Technical presentation to leadership received excellent feedback and follow-up questions",
        "Improved incident response time by 65% through new on-call procedures",
        "Open source contribution accepted as official feature in key framework we use",
        "Cross-team collaboration workshop led to identification of three process improvements"
      ],
      areasForSupport: [
        "Strategic thinking could benefit from more long-term horizon planning",
        "Stakeholder management during requirements gathering sometimes results in scope creep",
        "Technical debt prioritization needs more structured approach",
        "Change management communication during large technical transitions",
        "Balancing perfectionism with pragmatic delivery needs",
        "Scaling influence beyond immediate team to broader organization",
        "Confidence in executive-level communications"
      ],
      actionItems: [
        "Schedule 5-year technical vision workshop with architecture team",
        "Create requirements gathering template with explicit scope boundaries",
        "Implement quarterly technical debt review with prioritization framework",
        "Develop change management communication template for technical transitions",
        "Define 'good enough' criteria for different types of deliverables",
        "Schedule lunch and learns with adjacent teams to share knowledge and build influence",
        "Set up monthly practice sessions for executive communications"
      ],
      transcript: "Our mid-April session highlighted Morgan's continued growth as a technical leader. We celebrated the success of the microservice architecture design and the significant improvements in work-life balance through effective delegation. Morgan shared insights about the structured mentoring program and its measurable impact on junior team productivity. We discussed areas for continued development, particularly around strategic thinking, stakeholder management, and scaling organizational influence. Morgan expressed particular interest in developing executive communication skills as a path to increasing impact at the organizational level.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - May 3rd",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 59), // 59 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan achieved significant milestones this month in both technical delivery and leadership growth. The 5-year technical vision workshop was highly effective and resulted in an actionable roadmap embraced by leadership. Work-life balance remains stable, and delegation effectiveness continues to improve. Organizational influence is expanding through knowledge sharing and strategic contributions.",
      wins: [
        "Successfully facilitated 5-year technical vision workshop resulting in approved roadmap",
        "Requirements gathering template reduced scope creep incidents by 40%",
        "Technical debt prioritization framework implemented and first review completed",
        "Led cross-functional working group that resolved long-standing platform stability issue",
        "Mentored two senior developers on architecture design patterns with excellent feedback",
        "Lunch and learn sessions expanded knowledge sharing to three adjacent teams",
        "Executive communication skills showing improvement through practice sessions",
        "Work-life balance maintained with consistent 45-hour weeks"
      ],
      areasForSupport: [
        "Handling difficult stakeholder conversations when technical constraints conflict with desires",
        "Balancing innovation exploration with delivery commitments",
        "Scaling personal impact through larger organizational initiatives",
        "Career pathing clarity between technical specialist vs. people management tracks",
        "Developing industry thought leadership presence",
        "Finding opportunities for strategic influence at executive level",
        "Managing growing demands on time as visibility increases"
      ],
      actionItems: [
        "Role play difficult stakeholder conversations in next coaching session",
        "Create innovation time allocation framework (20% time approach)",
        "Identify strategic organizational initiative to lead in Q3",
        "Schedule career discussion focusing on technical vs. management path options",
        "Develop proposal for industry conference presentation",
        "Create executive-focused technical newsletter to increase visibility",
        "Implement time management system with clearer prioritization mechanisms"
      ],
      transcript: "Our early May meeting celebrated Morgan's achievements in strategic technical leadership and continued work-life balance improvements. The 5-year vision workshop was particularly impactful, establishing Morgan as a forward-thinking technical leader beyond the immediate team. We discussed the successful implementation of several frameworks Morgan developed, including requirements gathering and technical debt prioritization, both of which are showing measurable positive impacts. Morgan expressed interest in developing more clarity around career direction, specifically evaluating technical specialist versus people management tracks. We also explored opportunities for expanding industry presence through conference speaking and content creation.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - May 17th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45), // 45 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan continues to excel in balancing technical excellence with growing leadership responsibilities. The innovation time framework has already produced valuable prototype solutions. Career direction is crystallizing toward the technical leadership track with limited people management. Industry visibility is increasing through accepted conference proposals and content creation.",
      wins: [
        "Innovation time framework successfully implemented with first prototype showing promise",
        "Difficult stakeholder conversation role play techniques successfully applied in real scenario",
        "Conference presentation proposal accepted at major industry event",
        "First executive technical newsletter received positive feedback and follow-up questions",
        "Successfully navigated complex cross-team dependency issue blocking critical feature",
        "Career path discussion led to clarity on technical leadership focus with limited management",
        "Time management system showing 27% improvement in high-priority task completion",
        "Mentees demonstrating independent problem-solving on complex technical challenges"
      ],
      areasForSupport: [
        "Preparing compelling conference presentation materials",
        "Strategic influence techniques with resistant stakeholders",
        "Measuring and communicating technical leadership impact",
        "Building executive sponsorship for technical leadership advancement",
        "Scaling knowledge sharing beyond direct interactions",
        "Maintaining technical depth while expanding leadership breadth",
        "Establishing boundaries as demands on time continue to increase"
      ],
      actionItems: [
        "Schedule presentation coaching session for conference preparation",
        "Read 'Influencing Without Authority' book and apply key techniques",
        "Create technical leadership impact metrics dashboard",
        "Identify potential executive sponsor and schedule initial coffee chat",
        "Begin creating knowledge base of technical decision frameworks",
        "Block 6 hours weekly for hands-on technical work to maintain skills",
        "Implement 'office hours' approach for non-urgent support requests"
      ],
      transcript: "Our mid-May session focused on Morgan's continued growth balancing technical excellence with expanding leadership influence. The innovation time framework is showing early positive results, with the first prototype already generating interest from product teams. Morgan shared insights from successfully applying stakeholder conversation techniques in a challenging real-world scenario. We discussed the accepted conference proposal and strategized around preparation support. The career direction is crystallizing toward technical leadership with limited direct reports, leveraging Morgan's strengths while addressing preferences. The new time management approach is showing measurable improvements in focus and productivity.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - May 31st",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31), // 31 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan is demonstrating exceptional growth in technical leadership capabilities. Conference preparation is progressing well with strong rehearsal feedback. Executive sponsorship secured with CTO agreeing to monthly mentoring sessions. The technical impact metrics dashboard has been well-received and adopted by other technical leads. Overall trajectory continues to be strongly positive.",
      wins: [
        "Presentation coaching session yielded significant improvements in conference materials",
        "Secured executive sponsorship with CTO agreeing to monthly mentoring",
        "Technical leadership impact dashboard adopted by three other technical leads",
        "Innovation time prototype moving to limited production trial with key customer",
        "Knowledge base of decision frameworks launched with positive initial feedback",
        "Successfully influenced product roadmap to include critical technical foundation work",
        "Office hours approach reduced interruptions by 45% while maintaining support quality",
        "Influencing techniques from reading successfully applied in cross-team initiative"
      ],
      areasForSupport: [
        "Scaling personal impact through process improvements and tooling",
        "Navigating organizational politics at higher leadership levels",
        "Maintaining authenticity while adapting communication to executive audience",
        "Selecting appropriate opportunities from increasing inbound requests",
        "Building broader industry network for knowledge exchange",
        "Planning long-term career progression beyond current growth trajectory",
        "Balancing advocacy for team needs with organizational constraints"
      ],
      actionItems: [
        "Identify top three processes that could be improved through automation/tooling",
        "Schedule political navigation coaching session with experienced executive",
        "Create authentic communication framework for different organizational levels",
        "Develop opportunity evaluation rubric for prioritizing inbound requests",
        "Join two relevant industry communities for knowledge exchange",
        "Create 3-year career progression roadmap with specific milestones",
        "Document and prioritize team advocacy needs with impact/effort mapping"
      ],
      transcript: "Our end-of-May review reflected Morgan's continued strong growth trajectory. The conference preparation is advancing well, with the presentation coaching yielding noticeable improvements in content structure and delivery. A significant win was securing the CTO as an executive sponsor with agreement for monthly mentoring sessions. Morgan shared excitement about the technical leadership impact dashboard being adopted broadly, validating the approach to measuring and communicating technical leadership value. We discussed strategies for scaling impact beyond direct work through process improvements and automation. Morgan expressed interest in developing a longer-term career roadmap now that the technical leadership path is confirmed as the preferred direction.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - June 14th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 17), // 17 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan delivered an outstanding conference presentation that has generated significant positive visibility for both personal brand and company. The opportunity evaluation rubric has improved focus on high-impact work. First CTO mentoring session was highly productive with clear follow-up actions. Process automation initiatives are showing promising early results in developer productivity.",
      wins: [
        "Conference presentation received highest audience ratings with multiple follow-up inquiries",
        "First CTO mentoring session established clear growth focus areas with executive visibility",
        "Opportunity evaluation rubric redirected efforts to 30% higher impact activities",
        "Process automation pilot showing 25% reduction in routine development tasks",
        "Team advocacy efforts resulted in approval for additional performance testing environment",
        "Industry community participation led to valuable architectural insights applied to current project",
        "Three-year career roadmap completed with specific development milestones",
        "Innovation time project approved for full production implementation"
      ],
      areasForSupport: [
        "Managing increased external visibility and inbound opportunities post-conference",
        "Transitioning from individual contributor to technical leader on new strategic project",
        "Scaling mentoring impact beyond direct relationships",
        "Balancing company-specific expertise with broadly applicable industry knowledge",
        "Developing funding and resource negotiation skills for technical initiatives",
        "Creating appropriate work boundaries as influence and responsibilities grow",
        "Maintaining energy and focus with increasing demands on time"
      ],
      actionItems: [
        "Create external opportunity management system with clear filtering criteria",
        "Develop technical leadership transition plan for strategic project",
        "Design scalable mentoring program structure as alternative to 1:1 only approach",
        "Identify industry-standard techniques that could improve company-specific processes",
        "Schedule resource negotiation training with Finance partner",
        "Implement energy management strategy with focus on high-performance periods",
        "Establish clear boundary documentation for team and stakeholders"
      ],
      transcript: "Our mid-June review celebrated Morgan's outstanding conference presentation success and the positive impact it's having on both personal brand and company visibility. The opportunity evaluation rubric has proven effective in focusing efforts on truly high-impact work, demonstrating mature prioritization skills. Morgan shared valuable insights from the first CTO mentoring session, particularly around technical organization influence strategies. We discussed approaches for managing the increased visibility and inbound requests following the conference success. The process automation work is showing promising early results, with potential for significant team productivity improvements. Morgan expressed particular interest in developing a more structured approach to technical mentoring that could scale beyond direct one-on-one relationships.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - June 28th",
      teamMemberId: userId,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      duration: 60,
      status: "completed",
      processingStatus: "completed",
      meetingType: "one_on_one",
      executiveSummary: "Morgan has had an exceptional month with significant impact across technical leadership dimensions. The scalable mentoring program design has been approved for Q3 implementation. External opportunity management is working effectively, maintaining focus while capitalizing on high-value connections. Technical leadership transition for the strategic project is progressing smoothly with strong team engagement.",
      wins: [
        "Scalable mentoring program design approved with executive sponsorship for Q3 rollout",
        "External opportunity management system successfully filtering for highest-impact engagements",
        "Technical leadership transition plan for strategic project implemented with positive team feedback",
        "Resource negotiation approach secured additional cloud infrastructure budget for performance testing",
        "Energy management strategy showing improved sustainability despite increased responsibilities",
        "Boundary documentation clarifying expectations well-received by stakeholders",
        "Process automation expanded to second team with similar productivity improvements",
        "Second CTO mentoring session focused on strategic technical communication"
      ],
      areasForSupport: [
        "Scaling technical decision-making across multiple teams without becoming a bottleneck",
        "Balancing standardization with team autonomy in engineering practices",
        "Developing compelling business cases for technical investments",
        "Managing expectations with senior leadership around delivery timelines",
        "Creating space for continued technical depth in rapidly evolving areas",
        "Building structure for knowledge sharing that doesn't rely on synchronous communication",
        "Preparing for potential organizational changes in engineering leadership"
      ],
      actionItems: [
        "Document technical decision-making framework with delegation guidelines",
        "Create engineering practice flexibility matrix showing required vs. optional standards",
        "Schedule workshop with Finance to improve technical investment business cases",
        "Develop expectation management playbook for senior leadership communications",
        "Identify top three technical areas requiring continued depth and allocate learning time",
        "Design asynchronous knowledge sharing system integrated with existing tools",
        "Create personal position statement clarifying unique value proposition"
      ],
      transcript: "Our end-of-June session recognized Morgan's exceptional month of impact and growth. The scalable mentoring program design represents a significant organizational contribution that will extend Morgan's influence well beyond direct interactions. We discussed the effectiveness of the external opportunity management system in maintaining focus while still capitalizing on valuable industry connections. The technical leadership transition for the strategic project demonstrates Morgan's growing ability to lead through influence rather than direct contribution. We explored strategies for scaling technical decision-making without creating bottlenecks or reducing team autonomy. Morgan expressed particular interest in developing more compelling business cases for technical investments, recognizing this as a key skill for higher-level technical leadership.",
      createdBy: userId
    },
    {
      title: "1:1 Meeting - July 12th",
      teamMemberId: userId,
      date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 11), // 11 days in future
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