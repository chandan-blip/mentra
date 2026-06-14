import { BookOpen, Code2, Compass, GraduationCap } from 'lucide-react';
import { FeaturePreview } from '../../components/FeaturePreview.js';

export function LearningPage() {
  return (
    <FeaturePreview
      icon={<GraduationCap />}
      title="Learning"
      tagline="Structured lessons mapped to your roadmap"
      description="A guided learning library where each roadmap topic links to curated lessons, readings, and practice. Track what you've mastered and pick up exactly where you left off."
      features={[
        { icon: <BookOpen className="size-5" />, title: 'Topic lessons', desc: 'Bite-sized lessons attached to every roadmap item.' },
        { icon: <Code2 className="size-5" />, title: 'Hands-on practice', desc: 'Practice sets that reinforce each concept as you learn.' },
        { icon: <Compass className="size-5" />, title: 'Mastery tracking', desc: 'See which skills you’ve locked in and what’s next.' },
      ]}
    />
  );
}
