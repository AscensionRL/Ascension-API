import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
  DEVELOPER = 'developer',
}

export type OnboardingStep = 'email' | 'username' | 'epicName' | 'password';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ name: 'username_confirmed', type: 'boolean', default: true })
  usernameConfirmed: boolean;

  @Column({ unique: true, type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ name: 'display_name', type: 'varchar', length: 80, nullable: true })
  displayName: string | null;

  @Column({ name: 'epic_name', type: 'varchar', length: 100, nullable: true })
  epicName: string | null;

  @Column({ name: 'epic_account_id', type: 'varchar', length: 100, nullable: true })
  epicAccountId: string | null;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', length: 8, nullable: true })
  region: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'discord_id', type: 'varchar', length: 100, unique: true, nullable: true })
  discordId: string | null;

  @Column({ name: 'google_id', type: 'varchar', length: 100, unique: true, nullable: true })
  googleId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'username_changed_at', type: 'timestamptz', nullable: true })
  usernameChangedAt: Date | null;

  @Column({ name: 'two_factor_method', type: 'varchar', length: 10, nullable: true })
  twoFactorMethod: TwoFactorMethod | null;

  @Column({ name: 'totp_secret', type: 'varchar', length: 255, nullable: true })
  totpSecret: string | null;

  @Column({ name: 'ascension_stats', type: 'jsonb', nullable: true })
  ascensionStats: AscensionStats | null;
}

export type TwoFactorMethod = 'email' | 'totp';

export interface Placement {
  placement: string;
  tourneyName: string;
}

export interface AscensionStats {
  tourneyWins: number;
  tourneyLosses: number;
  tourneysParticipated: number;
  bestPlacement: Placement | null;
  lastPlacement: Placement | null;
}

export const USERNAME_COOLDOWN_DAYS = 30;
const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function usernameChangeAvailableAt(user: User): Date | null {
  if (!user.usernameChangedAt) return null;
  const next = new Date(user.usernameChangedAt.getTime() + USERNAME_COOLDOWN_MS);
  return next.getTime() > Date.now() ? next : null;
}

export function getPendingOnboarding(user: User): OnboardingStep[] {
  const pending: OnboardingStep[] = [];
  if (!user.email) pending.push('email');
  if (!user.usernameConfirmed) pending.push('username');
  if (!user.epicName) pending.push('epicName');
  if (!user.passwordHash) pending.push('password');
  return pending;
}

export interface PublicUser {
  id: string;
  username: string;
  usernameConfirmed: boolean;
  email: string | null;
  displayName: string | null;
  epicName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  region: string | null;
  bio: string | null;
  emailVerified: boolean;
  hasDiscord: boolean;
  hasGoogle: boolean;
  hasPassword: boolean;
  pendingOnboarding: OnboardingStep[];
  canChangeUsername: boolean;
  usernameChangeAvailableAt: Date | null;
  twoFactorMethod: TwoFactorMethod | null;
  ascensionStats: PublicAscensionStats | null;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface PublicAscensionStats extends AscensionStats {
  winRate: number;
}

function toPublicStats(stats: AscensionStats | null): PublicAscensionStats | null {
  if (!stats) return null;
  const total = stats.tourneyWins + stats.tourneyLosses;
  const winRate = total > 0 ? Math.round((stats.tourneyWins / total) * 100) : 0;
  return { ...stats, winRate };
}

export function toPublicUser(user: User): PublicUser {
  const nextUsernameChange = usernameChangeAvailableAt(user);
  return {
    id: user.id,
    username: user.username,
    usernameConfirmed: user.usernameConfirmed,
    email: user.email,
    displayName: user.displayName,
    epicName: user.epicName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    region: user.region,
    bio: user.bio,
    emailVerified: user.emailVerified,
    hasDiscord: !!user.discordId,
    hasGoogle: !!user.googleId,
    hasPassword: !!user.passwordHash,
    pendingOnboarding: getPendingOnboarding(user),
    canChangeUsername: nextUsernameChange === null,
    usernameChangeAvailableAt: nextUsernameChange,
    twoFactorMethod: user.twoFactorMethod,
    ascensionStats: toPublicStats(user.ascensionStats),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}
