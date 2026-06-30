import {
  AdminMutedSection,
  AdminSection,
  AdminStatCard,
  AdminTableSection,
} from "@/components/admin-ui";
import type { ReactNode } from "react";
import {
  introCandidateSourceLabels,
  introCandidateStatusLabels,
  interestSourceLabels,
  interestStatusLabels,
  type DashboardExposureData,
  type DashboardIntroCandidate,
  type DashboardInterest,
} from "@/lib/domain";

type OfferMatchDashboardProps = DashboardExposureData & {
  searchQuery?: string;
};

type OfferPairRow = {
  pairKey: string;
  userAId: number;
  userBId: number;
  userAName: string;
  userBName: string;
  forward: DashboardInterest | null;
  forwardAtIso: string | null;
  reverse: DashboardInterest | null;
  reverseAtIso: string | null;
  introCandidate: DashboardIntroCandidate | null;
  latestAtIso: string | null;
};

export function OfferMatchDashboard({
  users,
  interests,
  introCandidates,
  loadError,
  searchQuery = "",
}: OfferMatchDashboardProps) {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ko-KR");
  const hasQuery = normalizedQuery.length > 0;
  const matchesText = (value: string) => !hasQuery || value.toLocaleLowerCase("ko-KR").includes(normalizedQuery);
  const filteredInterests = interests.filter((interest) => {
    if (!hasQuery) return true;
    return matchesText(interest.fromUserName) || matchesText(interest.toUserName);
  });
  const filteredCandidates = introCandidates.filter((candidate) => {
    if (!hasQuery) return true;
    return matchesText(candidate.userAName) || matchesText(candidate.userBName) || matchesText(candidate.reason);
  });
  const filteredUsers = users.filter((user) => {
    if (!hasQuery) return true;
    return matchesText(user.name);
  });
  const pairRows = buildPairRows(filteredInterests, filteredCandidates);
  const activeInterests = filteredInterests.filter((interest) => interest.status === "ACTIVE");
  const activePairRows = pairRows.filter((row) => row.forward?.status === "ACTIVE" || row.reverse?.status === "ACTIVE");
  const mutualPairRows = activePairRows.filter((row) => isMutualPair(row));
  const uniqueActors = new Set(activeInterests.map((interest) => interest.fromUserId)).size;
  const uniqueTargets = new Set(activeInterests.map((interest) => interest.toUserId)).size;
  const convertedCandidates = filteredCandidates.filter((candidate) => candidate.status === "CONVERTED_TO_INTRO_CASE").length;

  return (
    <div className="grid gap-6">
      <AdminMutedSection className="p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-bold text-[#e63a68]">Offer interest management</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">
              오퍼 기준으로 일방향 관심과 전환 상태를 한눈에 확인합니다.
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              각 사용자가 오퍼 사이트에서 남긴 단방향 관심 기록을 모아, 상호 관심과 소개 후보 전환 상태를 바로 볼 수 있습니다.
            </p>
            <p className="mt-3 text-xs font-semibold text-zinc-500">
              관심을 받은 사용자 {uniqueTargets}명 · 소개 전환 완료 {convertedCandidates}건
            </p>
            {loadError ? <p className="mt-3 text-xs font-semibold text-red-700">{loadError}</p> : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <AdminStatCard label="활성 관심" value={activeInterests.length} />
            <AdminStatCard label="관심 남긴 사용자" value={uniqueActors} tone="blue" />
            <AdminStatCard label="상호 관심 쌍" value={mutualPairRows.length} tone="green" />
            <AdminStatCard label="전환 완료" value={convertedCandidates} tone="amber" />
          </div>
        </div>
      </AdminMutedSection>

      <AdminSection className="p-4 sm:p-5">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" method="get">
          <Field label="이름 검색">
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="예: 이원민"
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#e63a68] focus:ring-2 focus:ring-[#ffe2ea]"
            />
          </Field>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-2xl bg-[#e63a68] px-4 py-3 text-sm font-semibold text-white">
              검색
            </button>
            <a href="/matches" className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600">
              초기화
            </a>
          </div>
        </form>
      </AdminSection>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <OfferInterestTable interests={filteredInterests} query={searchQuery} />
        <OfferCandidateTable introCandidates={filteredCandidates} query={searchQuery} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <OfferUserSummaryTable users={filteredUsers} pairRows={pairRows} query={searchQuery} />
      </section>
    </div>
  );
}

function OfferCandidateTable({ introCandidates, query }: { introCandidates: DashboardIntroCandidate[]; query: string }) {
  return (
    <AdminSection className="grid gap-0 overflow-hidden">
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">전환 후보</h2>
        <p className="mt-1 text-sm text-zinc-500">상호 관심에서 운영자가 검토 중인 소개 후보를 따로 볼 수 있습니다.</p>
      </div>
      <div className="grid gap-3 p-4">
        {introCandidates.length === 0 ? (
          <p className="rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
            후보가 없습니다.
          </p>
        ) : (
          introCandidates.map((candidate) => (
            <article key={candidate.id} className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">#{candidate.id}</p>
                  <p className="mt-1 text-base font-bold text-zinc-950">
                    {highlightText(candidate.userAName, query)} <span className="text-zinc-400">↔</span>{" "}
                    {highlightText(candidate.userBName, query)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">{highlightText(candidate.reason, query)}</p>
                </div>
                <CandidateBadge candidate={candidate} />
              </div>
              <div className="mt-4 grid gap-2 text-xs text-zinc-600">
                <p>출처: {introCandidateSourceLabels[candidate.source]}</p>
                <p>갱신: {candidate.updatedAt}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </AdminSection>
  );
}

function OfferInterestTable({ interests, query }: { interests: DashboardInterest[]; query: string }) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">일방향 관심 기록</h2>
        <p className="mt-1 text-sm text-zinc-500">A → B, B → A 를 각각 한 줄씩 보여 줍니다.</p>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {interests.length === 0 ? (
          <p className="rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">기록이 없습니다.</p>
        ) : (
          interests.map((interest) => (
            <article key={interest.id} className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-zinc-950">{highlightText(interest.fromUserName, query)}</p>
                  <p className="mt-1 text-sm text-zinc-600">→ {highlightText(interest.toUserName, query)}</p>
                </div>
                <InterestBadge interest={interest} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                <p>출처: {interestSourceLabels[interest.source]}</p>
                <p>상태: {interestStatusLabels[interest.status]}</p>
                <p className="col-span-2">갱신: {interest.createdAt}</p>
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold text-zinc-500">
            <tr>
              <th className="w-40 px-3 py-3">보낸 사람</th>
              <th className="w-40 px-3 py-3">받는 사람</th>
              <th className="w-32 px-3 py-3">출처</th>
              <th className="w-28 px-3 py-3">상태</th>
              <th className="w-28 px-3 py-3">상호</th>
              <th className="px-3 py-3">기록 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {interests.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                  기록이 없습니다.
                </td>
              </tr>
            ) : (
              interests.map((interest) => (
                <tr key={interest.id} className="align-top hover:bg-[#fff7fa]">
                  <td className="px-3 py-3 font-semibold text-zinc-950">{highlightText(interest.fromUserName, query)}</td>
                  <td className="px-3 py-3 text-zinc-700">{highlightText(interest.toUserName, query)}</td>
                  <td className="px-3 py-3 text-zinc-600">{interestSourceLabels[interest.source]}</td>
                  <td className="px-3 py-3">
                    <InterestBadge interest={interest} />
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{interest.isMutual ? "상호 관심" : "단방향 관심"}</td>
                  <td className="px-3 py-3 text-zinc-500">{interest.createdAt}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminTableSection>
  );
}

function OfferUserSummaryTable({
  users,
  pairRows,
  query,
}: {
  users: DashboardExposureData["users"];
  pairRows: OfferPairRow[];
  query: string;
}) {
  const pairCounts = new Map<number, { outgoing: number; incoming: number; mutual: number }>();
  for (const row of pairRows) {
    const left = pairCounts.get(row.userAId) ?? { outgoing: 0, incoming: 0, mutual: 0 };
    const right = pairCounts.get(row.userBId) ?? { outgoing: 0, incoming: 0, mutual: 0 };

    if (row.forward?.status === "ACTIVE") left.outgoing += 1;
    if (row.reverse?.status === "ACTIVE") left.incoming += 1;
    if (isMutualPair(row)) left.mutual += 1;

    if (row.reverse?.status === "ACTIVE") right.outgoing += 1;
    if (row.forward?.status === "ACTIVE") right.incoming += 1;
    if (isMutualPair(row)) right.mutual += 1;

    pairCounts.set(row.userAId, left);
    pairCounts.set(row.userBId, right);
  }

  const sortedUsers = [...users]
    .filter((user) => pairCounts.has(user.id))
    .sort((a, b) => (pairCounts.get(b.id)?.mutual ?? 0) - (pairCounts.get(a.id)?.mutual ?? 0))
    .slice(0, 16);

  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">사용자별 요약</h2>
        <p className="mt-1 text-sm text-zinc-500">각 사용자가 오퍼에서 얼마나 선택됐고, 서로 선택했는지 확인합니다.</p>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {sortedUsers.length === 0 ? (
          <p className="rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
            요약할 사용자가 없습니다.
          </p>
        ) : (
          sortedUsers.map((user) => {
            const stats = pairCounts.get(user.id) ?? { outgoing: 0, incoming: 0, mutual: 0 };
            return (
              <article key={user.id} className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
                <p className="text-base font-bold text-zinc-950">{highlightText(user.name, query)}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-zinc-600">
                  <MetricChip label="선택" value={`${stats.outgoing}건`} />
                  <MetricChip label="받음" value={`${stats.incoming}건`} />
                  <MetricChip label="상호" value={`${stats.mutual}쌍`} />
                </div>
              </article>
            );
          })
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold text-zinc-500">
            <tr>
              <th className="px-3 py-3">사용자</th>
              <th className="w-28 px-3 py-3">선택함</th>
              <th className="w-28 px-3 py-3">선택받음</th>
              <th className="w-28 px-3 py-3">상호</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {sortedUsers.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={4}>
                  요약할 사용자가 없습니다.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => {
                const stats = pairCounts.get(user.id) ?? { outgoing: 0, incoming: 0, mutual: 0 };
                return (
                  <tr key={user.id} className="hover:bg-[#fff7fa]">
                    <td className="px-3 py-3 font-semibold text-zinc-950">{highlightText(user.name, query)}</td>
                    <td className="px-3 py-3 text-zinc-700">{stats.outgoing}건</td>
                    <td className="px-3 py-3 text-zinc-700">{stats.incoming}건</td>
                    <td className="px-3 py-3 text-zinc-700">{stats.mutual}쌍</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AdminTableSection>
  );
}

function buildPairRows(interests: DashboardInterest[], introCandidates: DashboardIntroCandidate[]) {
  const pairMap = new Map<string, OfferPairRow>();

  for (const interest of interests) {
    const pairKey = interestPairKey(interest.fromUserId, interest.toUserId);
    const existing = pairMap.get(pairKey);
    const updatedAtIso = interest.createdAtIso ?? null;
    const currentTime = updatedAtIso ? Date.parse(updatedAtIso) : 0;

    const nextRow: OfferPairRow = existing ?? {
      pairKey,
      userAId: Math.min(interest.fromUserId, interest.toUserId),
      userBId: Math.max(interest.fromUserId, interest.toUserId),
      userAName: interest.fromUserId < interest.toUserId ? interest.fromUserName : interest.toUserName,
      userBName: interest.fromUserId < interest.toUserId ? interest.toUserName : interest.fromUserName,
      forward: null,
      forwardAtIso: null,
      reverse: null,
      reverseAtIso: null,
      introCandidate: null,
      latestAtIso: updatedAtIso,
    };

    const isForward = interest.fromUserId === nextRow.userAId && interest.toUserId === nextRow.userBId;
    if (isForward) {
      const forwardTime = nextRow.forwardAtIso ? Date.parse(nextRow.forwardAtIso) : 0;
      if (!nextRow.forward || currentTime >= forwardTime) {
        nextRow.forward = interest;
        nextRow.forwardAtIso = updatedAtIso;
      }
    } else {
      const reverseTime = nextRow.reverseAtIso ? Date.parse(nextRow.reverseAtIso) : 0;
      if (!nextRow.reverse || currentTime >= reverseTime) {
        nextRow.reverse = interest;
        nextRow.reverseAtIso = updatedAtIso;
      }
    }

    if (!nextRow.latestAtIso || currentTime >= Date.parse(nextRow.latestAtIso)) {
      nextRow.latestAtIso = updatedAtIso;
    }

    pairMap.set(pairKey, nextRow);
  }

  const candidateByPair = new Map<string, DashboardIntroCandidate>();
  for (const candidate of introCandidates) {
    const pairKey = interestPairKey(candidate.userAId, candidate.userBId);
    if (!candidateByPair.has(pairKey)) candidateByPair.set(pairKey, candidate);
  }

  return [...pairMap.values()]
    .map((row) => ({
      ...row,
      introCandidate: candidateByPair.get(row.pairKey) ?? null,
    }))
    .sort((a, b) => (Date.parse(b.latestAtIso ?? "") || 0) - (Date.parse(a.latestAtIso ?? "") || 0));
}

function isMutualPair(row: OfferPairRow) {
  return row.forward?.status === "ACTIVE" && row.reverse?.status === "ACTIVE";
}

function CandidateBadge({ candidate }: { candidate: DashboardIntroCandidate }) {
  const className =
    candidate.status === "APPROVED"
      ? "bg-sky-50 text-sky-700"
      : candidate.status === "REJECTED"
        ? "bg-rose-50 text-rose-700"
        : candidate.status === "CONVERTED_TO_INTRO_CASE"
          ? "bg-emerald-50 text-emerald-700"
          : "bg-[#fff1e6] text-[#c96a2b]";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{introCandidateStatusLabels[candidate.status]}</span>;
}

function highlightText(text: string, query: string): ReactNode {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return text;

  const lowerText = text.toLocaleLowerCase("ko-KR");
  const lowerQuery = normalizedQuery.toLocaleLowerCase("ko-KR");
  const index = lowerText.indexOf(lowerQuery);
  if (index < 0) return text;

  const before = text.slice(0, index);
  const match = text.slice(index, index + normalizedQuery.length);
  const after = text.slice(index + normalizedQuery.length);

  return (
    <>
      {before}
      <mark className="rounded bg-[#ffe2ea] px-0.5 text-[#b4234f]">{match}</mark>
      {after}
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-zinc-600">
      {label}
      {children}
    </label>
  );
}

function InterestBadge({ interest }: { interest: DashboardInterest }) {
  const className =
    interest.status === "ACTIVE"
      ? interest.isMutual
        ? "bg-emerald-50 text-emerald-700"
        : "bg-[#fff1e6] text-[#c96a2b]"
      : interest.status === "WITHDRAWN"
        ? "bg-zinc-100 text-zinc-600"
        : "bg-rose-50 text-rose-700";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{interestStatusLabels[interest.status]}</span>;
}

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-[11px] font-semibold text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-zinc-950">{value}</p>
    </div>
  );
}

function interestPairKey(userAId: number, userBId: number) {
  return userAId < userBId ? `${userAId}:${userBId}` : `${userBId}:${userAId}`;
}
