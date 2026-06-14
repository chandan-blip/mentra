// Demo data: 10 mentors (User + MentorProfile + StudentProfile avatar).
// Idempotent — re-running updates the same rows (keyed by email). This is DEMO data,
// kept separate from the bootstrap seed (seed.ts), which stays RBAC-only.
//
// Run with:  pnpm --filter @mentra/api db:seed:mentors
import argon2 from 'argon2';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { db } from '../src/db.js';
import { logger } from '../src/logger.js';
import { createId } from '../src/core/id.js';

type SeedMentor = {
  name: string;
  email: string;
  headline: string;
  bio: string;
  expertise: string[];
  techStack: string[];
  yearsExperience: number;
  sessionPriceCents: number;
  avatarUrl: string;
};

// Shared demo password for every seeded mentor (so you can log in as one if needed).
const DEMO_PASSWORD = 'Mentor@12345';

const av = (n: number) => `https://i.pravatar.cc/300?img=${n}`;

const MENTORS: SeedMentor[] = [
  { name: 'Aarav Sharma', email: 'aarav.sharma@demo.mentra.dev', headline: 'Senior SWE @ Google · System design & DSA', bio: 'I help engineers crack FAANG interviews and design systems that scale. 8 years across search and ads infra.', expertise: ['System design', 'DSA', 'Interview prep'], techStack: ['Go', 'Kubernetes', 'gRPC', 'Bigtable'], yearsExperience: 8, sessionPriceCents: 50000, avatarUrl: av(12) },
  { name: 'Priya Iyer', email: 'priya.iyer@demo.mentra.dev', headline: 'Engineering Manager @ Stripe · Career & leadership', bio: 'From IC to EM — I coach on growth, scope, and leading teams. Previously staff engineer on payments.', expertise: ['Career growth', 'Leadership', 'Eng management'], techStack: ['Java', 'Spring', 'AWS', 'Kafka'], yearsExperience: 11, sessionPriceCents: 60000, avatarUrl: av(5) },
  { name: 'Rohan Mehta', email: 'rohan.mehta@demo.mentra.dev', headline: 'Staff Frontend @ Figma · Design systems', bio: 'Frontend architecture, performance, and design systems. I love turning messy UIs into clean component libraries.', expertise: ['Frontend', 'Design systems', 'Performance'], techStack: ['React', 'TypeScript', 'CSS', 'WebGL'], yearsExperience: 9, sessionPriceCents: 0, avatarUrl: av(13) },
  { name: 'Ananya Verma', email: 'ananya.verma@demo.mentra.dev', headline: 'Data Scientist @ Netflix · ML & recsys', bio: 'Recommendation systems and applied ML. I mentor on breaking into DS and shipping models to production.', expertise: ['Machine learning', 'Data science', 'Recsys'], techStack: ['Python', 'PyTorch', 'SQL', 'Spark'], yearsExperience: 6, sessionPriceCents: 45000, avatarUrl: av(9) },
  { name: 'Karthik Nair', email: 'karthik.nair@demo.mentra.dev', headline: 'DevOps Lead @ Atlassian · Cloud & infra', bio: 'Kubernetes, IaC and CI/CD at scale. I help teams tame their infrastructure and cut cloud spend.', expertise: ['DevOps', 'Cloud', 'SRE'], techStack: ['AWS', 'Terraform', 'Docker', 'Kubernetes'], yearsExperience: 10, sessionPriceCents: 55000, avatarUrl: av(15) },
  { name: 'Sneha Reddy', email: 'sneha.reddy@demo.mentra.dev', headline: 'Product Engineer @ Notion · Full-stack', bio: 'Full-stack product work — shipping features end to end. Great for portfolio reviews and 0→1 builds.', expertise: ['Full-stack', 'Product', 'Startups'], techStack: ['Next.js', 'Postgres', 'tRPC', 'Prisma'], yearsExperience: 7, sessionPriceCents: 0, avatarUrl: av(20) },
  { name: 'Vikram Singh', email: 'vikram.singh@demo.mentra.dev', headline: 'Security Engineer @ Cloudflare · AppSec', bio: 'Application and network security. I mentor on secure coding, threat modeling and breaking into security.', expertise: ['Security', 'AppSec', 'Networking'], techStack: ['Go', 'Rust', 'Linux', 'eBPF'], yearsExperience: 12, sessionPriceCents: 65000, avatarUrl: av(33) },
  { name: 'Meera Joshi', email: 'meera.joshi@demo.mentra.dev', headline: 'Mobile Lead @ Swiggy · iOS & Android', bio: 'Native and cross-platform mobile. From architecture to app-store launches — I help mobile devs level up.', expertise: ['Mobile', 'iOS', 'Android'], techStack: ['Swift', 'Kotlin', 'Flutter'], yearsExperience: 9, sessionPriceCents: 40000, avatarUrl: av(25) },
  { name: 'Arjun Kapoor', email: 'arjun.kapoor@demo.mentra.dev', headline: 'Backend Architect @ Razorpay · Distributed systems', bio: 'High-throughput payments backends. Deep on distributed systems, consistency and event-driven design.', expertise: ['Backend', 'Distributed systems', 'Databases'], techStack: ['Java', 'Kafka', 'MySQL', 'Redis'], yearsExperience: 13, sessionPriceCents: 70000, avatarUrl: av(51) },
  { name: 'Divya Menon', email: 'divya.menon@demo.mentra.dev', headline: 'SRE @ Uber · Reliability & scale', bio: 'Keeping huge systems up. Observability, incident response and reliability engineering for ambitious devs.', expertise: ['SRE', 'Reliability', 'Observability'], techStack: ['Go', 'Prometheus', 'Kubernetes', 'Grafana'], yearsExperience: 8, sessionPriceCents: 50000, avatarUrl: av(44) },
];

async function findUserIdByEmail(email: string): Promise<string | null> {
  const [rows] = await db.execute<({ id: string } & RowDataPacket)[]>(
    'SELECT `id` FROM `User` WHERE `email` = :email LIMIT 1',
    { email },
  );
  return rows[0]?.id ?? null;
}

async function upsertMentor(m: SeedMentor, passwordHash: string): Promise<'created' | 'updated'> {
  // 1) User (keyed by unique email). Reuse the existing id on re-run.
  let userId = await findUserIdByEmail(m.email);
  const existed = Boolean(userId);
  if (!userId) {
    userId = createId();
    await db.execute<ResultSetHeader>(
      'INSERT INTO `User` (`id`, `email`, `passwordHash`, `name`, `role`, `roleId`, `status`, `emailVerified`) ' +
        "VALUES (:id, :email, :passwordHash, :name, 'mentor', 'mentor', 'active', 1)",
      { id: userId, email: m.email, passwordHash, name: m.name },
    );
  } else {
    await db.execute<ResultSetHeader>(
      "UPDATE `User` SET `name` = :name, `role` = 'mentor', `roleId` = 'mentor', `status` = 'active' WHERE `id` = :id",
      { id: userId, name: m.name },
    );
  }

  // 2) MentorProfile (one per user).
  const [mp] = await db.execute<({ id: string } & RowDataPacket)[]>(
    'SELECT `id` FROM `MentorProfile` WHERE `userId` = :userId LIMIT 1',
    { userId },
  );
  const profileParams = {
    userId,
    headline: m.headline,
    bio: m.bio,
    expertise: JSON.stringify(m.expertise),
    techStack: JSON.stringify(m.techStack),
    yearsExperience: m.yearsExperience,
    sessionPriceCents: m.sessionPriceCents,
  };
  if (mp[0]) {
    await db.execute<ResultSetHeader>(
      'UPDATE `MentorProfile` SET `headline` = :headline, `bio` = :bio, `expertise` = :expertise, ' +
        '`techStack` = :techStack, `yearsExperience` = :yearsExperience, `accepting` = 1, ' +
        '`sessionPriceCents` = :sessionPriceCents WHERE `userId` = :userId',
      profileParams,
    );
  } else {
    await db.execute<ResultSetHeader>(
      'INSERT INTO `MentorProfile` (`id`, `userId`, `headline`, `bio`, `expertise`, `techStack`, ' +
        '`yearsExperience`, `timezone`, `accepting`, `sessionPriceCents`) ' +
        "VALUES (:id, :userId, :headline, :bio, :expertise, :techStack, :yearsExperience, 'Asia/Kolkata', 1, :sessionPriceCents)",
      { id: createId(), ...profileParams },
    );
  }

  // 3) StudentProfile holds the avatar (shared across roles). Keyed by unique userId.
  await db.execute<ResultSetHeader>(
    'INSERT INTO `StudentProfile` (`id`, `userId`, `avatarUrl`, `timezone`, `onboardingComplete`, `onboardingStep`) ' +
      "VALUES (:id, :userId, :avatarUrl, 'Asia/Kolkata', 1, 4) " +
      'ON DUPLICATE KEY UPDATE `avatarUrl` = :avatarUrl, `onboardingComplete` = 1',
    { id: createId(), userId, avatarUrl: m.avatarUrl },
  );

  return existed ? 'updated' : 'created';
}

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  let created = 0;
  let updated = 0;
  for (const m of MENTORS) {
    const r = await upsertMentor(m, passwordHash);
    r === 'created' ? (created += 1) : (updated += 1);
  }

  logger.info({ created, updated, total: MENTORS.length, password: DEMO_PASSWORD }, 'seeded demo mentors');
}

main()
  .then(() => db.end())
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    logger.error({ err }, 'mentor seed failed');
    void db.end();
    process.exit(1);
  });
