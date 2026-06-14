import { Code2, FileCode2, GitPullRequest, Trophy } from 'lucide-react';
import { FeaturePreview } from '../../components/FeaturePreview.js';

export function ProjectsPage() {
  return (
    <FeaturePreview
      icon={<Code2 />}
      title="Projects"
      tagline="Build real things, reviewed like real work"
      description="Portfolio-grade projects with milestones, starter repos, and mentor code review. Ship end-to-end apps that prove your skills to recruiters."
      features={[
        { icon: <FileCode2 className="size-5" />, title: 'Guided briefs', desc: 'Clear specs and milestones for each project tier.' },
        { icon: <GitPullRequest className="size-5" />, title: 'PR-style review', desc: 'Submit your work and get structured feedback.' },
        { icon: <Trophy className="size-5" />, title: 'Portfolio ready', desc: 'Finished projects you can show off and deploy.' },
      ]}
    />
  );
}
