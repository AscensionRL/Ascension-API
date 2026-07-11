import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import {
  RlApiService,
  RlClub,
  RlLeaderboard,
  RlSkill,
} from '../common/rlapi/rlapi.service';
import { User } from '../users/user.entity';

export interface PlaylistRank {
  playlist: string;
  playlistLabel: string;
  status: 'Ranked' | 'Unranked';
  tier: string;
  rankName: string;
  division: number;
  mmr: number;
  matchesPlayed: number;
  placementMatchesPlayed: number;
  streak: number;
}

export interface ClubMember {
  name: string;
  role: string;
  isOwner: boolean;
}

export interface ClubInfo {
  name: string | null;
  tag: string | null;
  ownerName: string | null;
  memberCount: number;
  members: ClubMember[];
}

export interface StatEntry {
  key: string;
  label: string;
  value: number;
}

export interface RanksResponse {
  epicName: string | null;
  club: ClubInfo | null;
  stats: StatEntry[];
  hasData: boolean;
  status: 'ok' | 'no_epic' | 'unavailable';
  playlists: PlaylistRank[];
  updatedAt: string;
}

const STAT_ORDER = ['Goals', 'Assists', 'Saves', 'Shots', 'MVPs', 'Wins'];

const STAT_LABEL: Record<string, string> = {
  Goals: 'Tore',
  Assists: 'Assists',
  Saves: 'Saves',
  Shots: 'Schüsse',
  MVPs: 'MVPs',
  Wins: 'Siege',
};

const ROLE_LABEL: Record<number, string> = {
  1: 'Besitzer',
  2: 'Mitglied',
  3: 'Admin',
};

const CACHE_TTL = 600;
const PLACEMENT_REQUIRED = 10;
const ALLOWED_PLAYLISTS = [10, 11, 13];

const PLAYLIST_META: Record<number, { key: string; label: string }> = {
  10: { key: '1v1', label: 'Ranked Duel 1v1' },
  11: { key: '2v2', label: 'Ranked Doubles 2v2' },
  13: { key: '3v3', label: 'Ranked Standard 3v3' },
};

const TIER_TO_ICON: Record<number, string> = {
  1: 'Bronze 1', 2: 'Bronze 2', 3: 'Bronze 3',
  4: 'Silver 1', 5: 'Silver 2', 6: 'Silver 3',
  7: 'Gold 1', 8: 'Gold 2', 9: 'Gold 3',
  10: 'Platin 1', 11: 'Platin 2', 12: 'Platin 3',
  13: 'Diamond 1', 14: 'Diamond 2', 15: 'Diamond 3',
  16: 'Champion 1', 17: 'Champion 2', 18: 'Champion 3',
  19: 'Grand Champion 1', 20: 'Grand Champion 2', 21: 'Grand Champion 3',
  22: 'Super Sonic Legend',
};

const TIER_TO_NAME: Record<number, string> = {
  1: 'Bronze I', 2: 'Bronze II', 3: 'Bronze III',
  4: 'Silver I', 5: 'Silver II', 6: 'Silver III',
  7: 'Gold I', 8: 'Gold II', 9: 'Gold III',
  10: 'Platinum I', 11: 'Platinum II', 12: 'Platinum III',
  13: 'Diamond I', 14: 'Diamond II', 15: 'Diamond III',
  16: 'Champion I', 17: 'Champion II', 18: 'Champion III',
  19: 'Grand Champion I', 20: 'Grand Champion II', 21: 'Grand Champion III',
  22: 'Supersonic Legend',
};

@Injectable()
export class RanksService {
  constructor(
    private readonly rlApi: RlApiService,
    private readonly redis: RedisService,
  ) {}

  private empty(
    epicName: string | null,
    status: RanksResponse['status'],
  ): RanksResponse {
    return {
      epicName,
      club: null,
      stats: [],
      hasData: false,
      status,
      playlists: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private buildStats(leaderboards: RlLeaderboard[]): StatEntry[] {
    const byId = new Map(leaderboards.map((l) => [l.LeaderboardID, l.Value]));
    const ordered = STAT_ORDER.filter((id) => byId.has(id)).map((id) => ({
      key: id,
      label: STAT_LABEL[id] ?? id,
      value: byId.get(id) ?? 0,
    }));
    const extras = leaderboards
      .filter((l) => !STAT_ORDER.includes(l.LeaderboardID))
      .map((l) => ({ key: l.LeaderboardID, label: l.LeaderboardID, value: l.Value }));
    return [...ordered, ...extras];
  }

  private buildClub(club: RlClub | null): ClubInfo | null {
    if (!club || !club.name) return null;

    const members: ClubMember[] = club.members
      .filter((m) => (m.DeletedTime ?? 0) === 0)
      .map((m) => {
        const isOwner =
          (!!club.ownerPlayerId && m.PlayerID === club.ownerPlayerId) ||
          m.RoleID === 1;
        return {
          name: m.PlayerName || m.EpicPlayerName || 'Unbekannt',
          role: isOwner ? 'Besitzer' : (ROLE_LABEL[m.RoleID ?? 2] ?? 'Mitglied'),
          isOwner,
        };
      })
      .sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

    const owner = members.find((m) => m.isOwner) ?? null;

    return {
      name: club.name,
      tag: club.tag,
      ownerName: owner?.name ?? null,
      memberCount: members.length,
      members,
    };
  }

  private mapSkill(playlistId: number, skill: RlSkill | undefined): PlaylistRank {
    const meta = PLAYLIST_META[playlistId];
    if (!skill) {
      return {
        playlist: meta.key,
        playlistLabel: meta.label,
        status: 'Unranked',
        tier: 'Unranked',
        rankName: 'Unranked',
        division: 0,
        mmr: 0,
        matchesPlayed: 0,
        placementMatchesPlayed: 0,
        streak: 0,
      };
    }

    const placement = skill.PlacementMatchesPlayed ?? 0;
    const unranked = placement < PLACEMENT_REQUIRED;
    const mmr = Math.round(skill.MMR * 20 + 100);

    return {
      playlist: meta.key,
      playlistLabel: meta.label,
      status: unranked ? 'Unranked' : 'Ranked',
      tier: unranked ? 'Unranked' : (TIER_TO_ICON[skill.Tier] ?? 'Unranked'),
      rankName: unranked ? 'Unranked' : (TIER_TO_NAME[skill.Tier] ?? 'Unbekannt'),
      division: unranked ? 0 : skill.Division + 1,
      mmr,
      matchesPlayed: skill.MatchesPlayed ?? 0,
      placementMatchesPlayed: placement,
      streak: skill.WinStreak ?? 0,
    };
  }

  async getForUser(user: User): Promise<RanksResponse> {
    if (!user.epicName) return this.empty(null, 'no_epic');

    const cacheKey = `ranks:v3:${user.epicName.toLowerCase()}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as RanksResponse;

    let accountId = user.epicAccountId;
    if (!accountId) {
      const resolved = await this.rlApi.resolveEpic(user.epicName);
      if (resolved.status !== 'ok') return this.empty(user.epicName, 'unavailable');
      accountId = resolved.accountId;
    }

    const profile = await this.rlApi.getFullProfile(accountId);
    if (!profile) return this.empty(user.epicName, 'unavailable');

    const skillByPlaylist = new Map<number, RlSkill>();
    for (const skill of profile.skills) {
      if (ALLOWED_PLAYLISTS.includes(skill.Playlist)) {
        skillByPlaylist.set(skill.Playlist, skill);
      }
    }

    const playlists = ALLOWED_PLAYLISTS.map((pl) =>
      this.mapSkill(pl, skillByPlaylist.get(pl)),
    );

    const response: RanksResponse = {
      epicName: profile.playerName ?? user.epicName,
      club: this.buildClub(profile.club),
      stats: this.buildStats(profile.leaderboards),
      hasData: true,
      status: 'ok',
      playlists,
      updatedAt: new Date().toISOString(),
    };

    await this.redis.set(cacheKey, JSON.stringify(response), CACHE_TTL);
    return response;
  }
}
