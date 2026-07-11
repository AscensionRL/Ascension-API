import { Injectable, Logger } from '@nestjs/common';

export type EpicResolveResult =
  | { status: 'ok'; accountId: string }
  | { status: 'not_found' }
  | { status: 'unavailable' };

type ResolveOutcome =
  | { kind: 'ok'; accountId: string }
  | { kind: 'no_result' }
  | { kind: 'auth' }
  | { kind: 'error' };

export interface RlSkill {
  Playlist: number;
  Tier: number;
  Division: number;
  MMR: number;
  MatchesPlayed?: number;
  PlacementMatchesPlayed?: number;
  WinStreak?: number;
}

export interface RlClubMember {
  PlayerID?: string;
  EpicPlayerID?: string;
  PlayerName?: string;
  EpicPlayerName?: string;
  RoleID?: number;
  DeletedTime?: number;
}

export interface RlClub {
  clubId: number | null;
  name: string | null;
  tag: string | null;
  ownerPlayerId: string | null;
  members: RlClubMember[];
}

export interface RlLeaderboard {
  LeaderboardID: string;
  Value: number;
}

export interface RlProfile {
  playerName: string | null;
  club: RlClub | null;
  skills: RlSkill[];
  leaderboards: RlLeaderboard[];
}

interface RlProfileResponse {
  Result?: {
    Skills?: RlSkill[];
    Leaderboards?: RlLeaderboard[];
    PlayerData?: { PlayerName?: string };
    ClubDetails?: {
      ClubID?: number;
      ClubName?: string;
      ClubTag?: string;
      OwnerPlayerID?: string;
      Members?: RlClubMember[];
    };
  };
}

@Injectable()
export class RlApiService {
  private readonly logger = new Logger(RlApiService.name);

  private get baseUrl(): string {
    return process.env.RL_API_URI ?? 'https://rl.rocketplanet.gg/api/v1';
  }

  private get apiKey(): string {
    return process.env.RL_API_KEY ?? '';
  }

  private post(path: string, body: unknown): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  }

  async resolveEpic(epicName: string): Promise<EpicResolveResult> {

    const first = await this.tryResolve(epicName);
    if (first.kind === 'ok') return { status: 'ok', accountId: first.accountId };

    this.logger.warn(
      `Resolve "${epicName}" – 1. Versuch fehlgeschlagen (${first.kind}). ` +
        `Starte Clients neu und versuche erneut …`,
    );

    const restarted = await this.restartClients();
    if (restarted) {
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      this.logger.warn(
        'RestartClients selbst fehlgeschlagen (vermutlich Token/Netzwerk).',
      );
    }

    const second = await this.tryResolve(epicName);
    if (second.kind === 'ok') return { status: 'ok', accountId: second.accountId };

    if (second.kind === 'no_result') {

      return { status: 'not_found' };
    }
    this.logger.error(
      `Resolve "${epicName}" auch nach Client-Neustart fehlgeschlagen (${second.kind}) ` +
        `– vermutlich abgelaufener RL_API_KEY oder API-Störung.`,
    );
    return { status: 'unavailable' };
  }

  private async tryResolve(epicName: string): Promise<ResolveOutcome> {
    try {
      const res = await this.post('/Resolver/ResolveUser', { User: epicName });
      if (res.status === 401 || res.status === 403) {
        this.logger.error(
          `RLAPI 401/403 – der RL_API_KEY ist vermutlich abgelaufen/ungültig.`,
        );
        return { kind: 'auth' };
      }
      if (!res.ok) return { kind: 'error' };

      const data = (await res.json()) as { Result?: { AccountID?: string } };
      const accountId = data?.Result?.AccountID;
      return accountId ? { kind: 'ok', accountId } : { kind: 'no_result' };
    } catch (err) {
      this.logger.error(
        `RLAPI ResolveUser fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { kind: 'error' };
    }
  }

  async getFullProfile(accountId: string): Promise<RlProfile | null> {
    const first = await this.tryProfile(accountId);
    if (first) return first;

    this.logger.warn(
      `GetFullProfile "${accountId}" – 1. Versuch fehlgeschlagen. Starte Clients neu und versuche erneut …`,
    );
    const restarted = await this.restartClients();
    if (restarted) await new Promise((r) => setTimeout(r, 1500));

    return this.tryProfile(accountId);
  }

  private async tryProfile(accountId: string): Promise<RlProfile | null> {
    try {
      const res = await this.post('/Players/GetFullProfile', {
        PlayerID: `Epic|${accountId}|0`,
      });
      if (!res.ok) return null;

      const data = (await res.json()) as RlProfileResponse;
      const result = data?.Result;
      if (!result) return null;

      const cd = result.ClubDetails;
      const club: RlClub | null = cd
        ? {
            clubId: cd.ClubID ?? null,
            name: cd.ClubName ?? null,
            tag: cd.ClubTag ?? null,
            ownerPlayerId: cd.OwnerPlayerID ?? null,
            members: Array.isArray(cd.Members) ? cd.Members : [],
          }
        : null;

      return {
        playerName: result.PlayerData?.PlayerName ?? null,
        club,
        skills: Array.isArray(result.Skills) ? result.Skills : [],
        leaderboards: Array.isArray(result.Leaderboards) ? result.Leaderboards : [],
      };
    } catch (err) {
      this.logger.error(
        `RLAPI GetFullProfile fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async restartClients(): Promise<boolean> {
    try {
      const res = await this.post('/Admin/RestartClients', {});
      return res.ok;
    } catch {
      return false;
    }
  }
}
