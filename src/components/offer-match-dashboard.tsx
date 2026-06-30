import {
  AdminMutedSection,
  AdminSection,
  AdminStatCard,
  AdminTableSection,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from "@/components/admin-ui";
import { FormPendingFieldset } from "@/components/form-pending-fieldset";
import { FormSubmitButton } from "@/components/form-submit-button";
import { deleteIntroCaseAction } from "@/app/actions";
import {
  introCandidateSourceLabels,
  introCandidateStatusLabels,
  introStatusLabels,
  interestSourceLabels,
  interestStatusLabels,
  openLevelLabels,
  userStatusLabels,
  type DashboardExposureData,
  type DashboardIntroCandidate,
  type DashboardInterest,
  type DashboardIntroCase,
} from "@/lib/domain";
import type { ReactNode } from "react";

type OfferMatchDashboardProps = DashboardExposureData & {
  canManage?: boolean;
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
  introCases,
  canManage = false,
  loadError,
  searchQuery = "",
}: OfferMatchDashboardProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const highlightQuery = searchQuery.trim();
  const activeInterests = interests.filter((interest) => interest.status === "ACTIVE");
  const pairRows = buildPairRows(interests, introCandidates);
  const activePairRows = pairRows.filter((row) => row.forward?.status === "ACTIVE" || row.reverse?.status === "ACTIVE");
  const filteredPairRows = filterPairRows(pairRows, normalizedQuery);
  const filteredCandidates = filterIntroCandidates(introCandidates, normalizedQuery);
  const filteredInterests = filterInterests(interests, normalizedQuery);
  const filteredIntroCases = filterIntroCases(introCases, normalizedQuery);
  const filteredUsers = filterUsers(users, normalizedQuery, filteredPairRows, filteredIntroCases);
  const mutualPairRows = activePairRows.filter((row) => isMutualPair(row));
  const uniqueActors = new Set(activeInterests.map((interest) => interest.fromUserId)).size;
  const uniqueTargets = new Set(activeInterests.map((interest) => interest.toUserId)).size;
  const convertedCandidates = introCandidates.filter((candidate) => candidate.status === "CONVERTED_TO_INTRO_CASE").length;
  const hasSearch = normalizedQuery.length > 0;
  const searchSummary = hasSearch
    ? `검색어 "${searchQuery.trim()}" 기준으로 ${filteredPairRows.length}개 페어, ${filteredCandidates.length}개 후보, ${filteredInterests.length}개 관심, ${filteredIntroCases.length}개 소개 기록을 표시합니다.`
    : "검색어 없이 전체 기록을 표시합니다.";

  return (
    <div className="grid gap-6">
      <AdminMutedSection className="p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-sm font-bold text-[#e63a68]">Offer interest management</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">
              오퍼 기준으로 양방향 관심과 전환 상태를 한눈에 확인합니다.
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              각 사용자가 오퍼 사이트에서 최대 3명까지 남긴 관심 기록을 모아, 단방향 관심인지 상호 관심인지,
              그리고 소개 후보로 전환됐는지를 바로 볼 수 있습니다.
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

      <AdminSection className="grid gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold text-[#e63a68]">Match record search</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-zinc-950">매치 기록 검색</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              사용자 이름, 메모, 상태, 후보 이유를 함께 찾아보고 특정 소개 기록을 바로 삭제할 수 있습니다.
            </p>
          </div>
          <form action="/matches" method="get" className="flex w-full gap-2 lg:max-w-xl">
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="이름, 메모, 상태, 이유 검색"
              className={`${adminInputClassName} flex-1`}
            />
            <button type="submit" className={adminPrimaryButtonClassName}>
              검색
            </button>
            {hasSearch ? (
              <a
                href="/matches"
                className={`${adminSecondaryButtonClassName} whitespace-nowrap px-4`}
              >
                초기화
              </a>
            ) : null}
          </form>
        </div>
        <p className="text-xs font-semibold text-zinc-500">{searchSummary}</p>
      </AdminSection>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <OfferPairTable pairRows={filteredPairRows} query={highlightQuery} />
        <OfferCandidateTable introCandidates={filteredCandidates} query={highlightQuery} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <OfferInterestTable interests={filteredInterests} query={highlightQuery} />
        <OfferUserSummaryTable users={filteredUsers} pairRows={filteredPairRows} query={highlightQuery} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr]">
        <OfferIntroCaseTable introCases={filteredIntroCases} canManage={canManage} query={highlightQuery} />
      </section>
    </div>
  );
}

function OfferPairTable({ pairRows, query }: { pairRows: OfferPairRow[]; query: string }) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">양측 관심 페어</h2>
        <p className="mt-1 text-sm text-zinc-500">A가 B를 봤는지, B가 A를 다시 봤는지를 같은 행에서 확인합니다.</p>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {pairRows.length === 0 ? (
          <p className="rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
            관심 기록이 없습니다.
          </p>
        ) : (
          pairRows.map((row) => (
            <article key={row.pairKey} className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">#{highlightText(row.pairKey, query)}</p>
                  <p className="mt-1 text-base font-bold text-zinc-950">
                    {highlightText(row.userAName, query)} <span className="text-zinc-400">↔</span> {highlightText(row.userBName, query)}
                  </p>
                </div>
                <PairBadge row={row} />
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <PairDirectionLine label={`${row.userAName} → ${row.userBName}`} interest={row.forward} />
                <PairDirectionLine label={`${row.userBName} → ${row.userAName}`} interest={row.reverse} />
              </div>
              <div className="mt-4 rounded-[20px] border border-zinc-100 bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-600">
                <p className="font-semibold text-zinc-700">상태</p>
                <p className="mt-1">{pairStateLabel(row)}</p>
                {row.introCandidate ? <p className="mt-1">{introCandidateLabel(row.introCandidate)}</p> : null}
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold text-zinc-500">
            <tr>
              <th className="w-44 px-3 py-3">페어</th>
              <th className="w-48 px-3 py-3">A → B</th>
              <th className="w-48 px-3 py-3">B → A</th>
              <th className="w-36 px-3 py-3">판정</th>
              <th className="w-36 px-3 py-3">후보 전환</th>
              <th className="px-3 py-3">최근 기록</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {pairRows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={6}>
                  관심 기록이 없습니다.
                </td>
              </tr>
            ) : (
              pairRows.map((row) => (
                <tr key={row.pairKey} className="align-top hover:bg-[#fff7fa]">
                  <td className="px-3 py-3">
                    <p className="font-semibold text-zinc-950">{highlightText(row.userAName, query)}</p>
                    <p className="text-xs font-semibold text-zinc-400">↔ {highlightText(row.userBName, query)}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{directionLabel(row.forward)}</td>
                  <td className="px-3 py-3 text-zinc-700">{directionLabel(row.reverse)}</td>
                  <td className="px-3 py-3">
                    <PairBadge row={row} />
                  </td>
                  <td className="px-3 py-3 text-zinc-700">{row.introCandidate ? introCandidateLabel(row.introCandidate) : "-"}</td>
                  <td className="px-3 py-3 text-zinc-500">{formatPairUpdatedAt(row.latestAtIso)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminTableSection>
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
                    {highlightText(candidate.userAName, query)} <span className="text-zinc-400">↔</span> {highlightText(candidate.userBName, query)}
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
        <h2 className="text-lg font-bold text-zinc-950">관심 기록</h2>
        <p className="mt-1 text-sm text-zinc-500">각 사용자가 오퍼 사이트에서 남긴 개별 선택 기록입니다.</p>
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

function OfferIntroCaseTable({
  introCases,
  canManage,
  query,
}: {
  introCases: DashboardIntroCase[];
  canManage: boolean;
  query: string;
}) {
  return (
    <AdminTableSection>
      <div className="border-b border-[#f1f5f9] px-5 py-4">
        <h2 className="text-lg font-bold text-zinc-950">소개 기록</h2>
        <p className="mt-1 text-sm text-zinc-500">운영자가 검색한 결과를 바로 삭제할 수 있습니다.</p>
      </div>
      <div className="grid gap-3 p-4 md:hidden">
        {introCases.length === 0 ? (
          <p className="rounded-[22px] border border-zinc-100 bg-zinc-50 px-4 py-5 text-sm text-zinc-500">
            소개 기록이 없습니다.
          </p>
        ) : (
          introCases.map((introCase) => (
            <article key={introCase.id} className="rounded-[24px] border border-zinc-100 bg-white p-4 shadow-[0_16px_35px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-500">#{introCase.id}</p>
                  <p className="mt-1 text-base font-bold text-zinc-950">{highlightText(formatIntroParticipants(introCase), query)}</p>
                  <p className="mt-1 text-sm text-zinc-600">{highlightText(introCase.invitor, query)}</p>
                </div>
                <IntroStatusBadge status={introCase.status} />
              </div>
              <p className="mt-4 rounded-[20px] border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                {highlightText(introCase.memo || "메모 없음", query)}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-zinc-500">{introCase.updatedAt}</p>
                {canManage ? (
                  <form action={deleteIntroCaseAction}>
                    <FormPendingFieldset className="contents">
                      <input type="hidden" name="id" value={introCase.id} />
                      <FormSubmitButton
                        label="삭제"
                        pendingLabel="삭제 중..."
                        className="text-xs font-bold text-zinc-500 hover:text-[#e63a68] disabled:text-zinc-300"
                      />
                    </FormPendingFieldset>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] table-fixed text-left text-sm">
          <thead className="bg-[#fafafc] text-xs font-bold text-zinc-500">
            <tr>
              <th className="w-16 px-3 py-3">ID</th>
              <th className="w-44 px-3 py-3">참여자</th>
              <th className="w-36 px-3 py-3">주선자</th>
              <th className="w-32 px-3 py-3">상태</th>
              <th className="px-3 py-3">메모</th>
              <th className="w-24 px-3 py-3">갱신</th>
              {canManage ? <th className="w-20 px-3 py-3">관리</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {introCases.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-zinc-500" colSpan={canManage ? 7 : 6}>
                  소개 기록이 없습니다.
                </td>
              </tr>
            ) : (
              introCases.map((introCase) => (
                <tr key={introCase.id} className="align-top hover:bg-[#fff7fa]">
                  <td className="px-3 py-3 font-semibold text-zinc-700">#{introCase.id}</td>
                  <td className="px-3 py-3 text-zinc-700">{highlightText(formatIntroParticipants(introCase), query)}</td>
                  <td className="px-3 py-3 text-zinc-700">{highlightText(introCase.invitor, query)}</td>
                  <td className="px-3 py-3">
                    <IntroStatusBadge status={introCase.status} />
                  </td>
                  <td className="px-3 py-3 text-xs leading-5 text-zinc-500">
                    <p className="line-clamp-2 break-words">{highlightText(introCase.memo || "-", query)}</p>
                  </td>
                  <td className="px-3 py-3 text-zinc-500">{introCase.updatedAt}</td>
                  {canManage ? (
                    <td className="px-3 py-3">
                      <form action={deleteIntroCaseAction}>
                        <FormPendingFieldset className="contents">
                          <input type="hidden" name="id" value={introCase.id} />
                          <FormSubmitButton
                            label="삭제"
                            pendingLabel="삭제 중..."
                            className="text-xs font-bold text-zinc-500 hover:text-[#e63a68] disabled:text-zinc-300"
                          />
                        </FormPendingFieldset>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))
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

function pairStateLabel(row: OfferPairRow) {
  if (row.introCandidate?.status === "CONVERTED_TO_INTRO_CASE") return "소개 전환 완료";
  if (isMutualPair(row)) return "양방향 관심";
  if (row.forward?.status === "ACTIVE" || row.reverse?.status === "ACTIVE") return "단방향 관심";
  if (row.forward || row.reverse) return "비활성 기록";
  return "기록 없음";
}

function introCandidateLabel(candidate: DashboardIntroCandidate) {
  return `${introCandidateSourceLabels[candidate.source]} · ${introCandidateStatusLabels[candidate.status]}`;
}

function directionLabel(interest: DashboardInterest | null) {
  if (!interest) return "-";
  return `${interestStatusLabels[interest.status]} · ${interestSourceLabels[interest.source]}`;
}

function PairDirectionLine({ label, interest }: { label: string; interest: DashboardInterest | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2">
      <span className="font-semibold text-zinc-700">{label}</span>
      <span className="text-xs text-zinc-500">{interest ? directionLabel(interest) : "없음"}</span>
    </div>
  );
}

function PairBadge({ row }: { row: OfferPairRow }) {
  const label = pairStateLabel(row);
  const className =
    label === "소개 전환 완료"
      ? "bg-emerald-50 text-emerald-700"
      : label === "양방향 관심"
        ? "bg-[#fff1e6] text-[#c96a2b]"
        : label === "단방향 관심"
          ? "bg-[#eff6ff] text-[#2563eb]"
          : "bg-zinc-100 text-zinc-600";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
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

function formatPairUpdatedAt(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function interestPairKey(userAId: number, userBId: number) {
  return userAId < userBId ? `${userAId}:${userBId}` : `${userBId}:${userAId}`;
}

function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;

  const normalizedQuery = query.trim().toLowerCase();
  const normalizedText = text.toLowerCase();
  if (!normalizedQuery || !normalizedText.includes(normalizedQuery)) return text;

  const result: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const nextIndex = normalizedText.indexOf(normalizedQuery, cursor);
    if (nextIndex < 0) {
      result.push(text.slice(cursor));
      break;
    }
    if (nextIndex > cursor) {
      result.push(text.slice(cursor, nextIndex));
    }
    result.push(
      <mark key={`match-${key++}`} className="rounded bg-[#fff1d6] px-0.5 text-inherit">
        {text.slice(nextIndex, nextIndex + normalizedQuery.length)}
      </mark>,
    );
    cursor = nextIndex + normalizedQuery.length;
  }

  return result.length > 0 ? <>{result}</> : text;
}

function filterPairRows(pairRows: OfferPairRow[], query: string) {
  if (!query) return pairRows;
  return pairRows.filter((row) =>
    matchesQuery(query, [
      row.pairKey,
      row.userAId,
      row.userBId,
      row.userAName,
      row.userBName,
      row.forward?.status,
      row.forward ? interestStatusLabels[row.forward.status] : null,
      row.forward ? interestSourceLabels[row.forward.source] : null,
      row.reverse?.status,
      row.reverse ? interestStatusLabels[row.reverse.status] : null,
      row.reverse ? interestSourceLabels[row.reverse.source] : null,
      row.introCandidate?.reason,
      row.introCandidate ? introCandidateStatusLabels[row.introCandidate.status] : null,
    ]),
  );
}

function filterIntroCandidates(introCandidates: DashboardIntroCandidate[], query: string) {
  if (!query) return introCandidates;
  return introCandidates.filter((candidate) =>
    matchesQuery(query, [
      candidate.id,
      candidate.userAName,
      candidate.userBName,
      candidate.reason,
      introCandidateSourceLabels[candidate.source],
      introCandidateStatusLabels[candidate.status],
    ]),
  );
}

function filterInterests(interests: DashboardInterest[], query: string) {
  if (!query) return interests;
  return interests.filter((interest) =>
    matchesQuery(query, [
      interest.id,
      interest.fromUserId,
      interest.toUserId,
      interest.fromUserName,
      interest.toUserName,
      interestSourceLabels[interest.source],
      interestStatusLabels[interest.status],
    ]),
  );
}

function filterIntroCases(introCases: DashboardIntroCase[], query: string) {
  if (!query) return introCases;
  return introCases.filter((introCase) =>
    matchesQuery(query, [
      introCase.id,
      introCase.participants.join(" "),
      introCase.invitor,
      introCase.status,
      introStatusLabels[introCase.status],
      introCase.memo,
      introCase.updatedAt,
    ]),
  );
}

function filterUsers(
  users: DashboardExposureData["users"],
  query: string,
  pairRows: OfferPairRow[],
  introCases: DashboardIntroCase[],
) {
  if (!query) return users;
  const pairUserIds = new Set(pairRows.flatMap((row) => [row.userAId, row.userBId]));
  const introUserNames = new Set(
    introCases.flatMap((introCase) => introCase.participants),
  );
  return users.filter(
    (user) =>
      matchesQuery(query, [
        user.id,
        user.name,
        user.gender,
        userStatusLabels[user.status],
        openLevelLabels[user.openLevel],
        user.jobTitle,
      ]) ||
      pairUserIds.has(user.id) ||
      introUserNames.has(user.name),
  );
}

function matchesQuery(query: string, values: Array<string | number | null | undefined>) {
  return values.some((value) => normalizeSearchValue(value).includes(query));
}

function normalizeSearchValue(value: string | number | null | undefined) {
  return String(value ?? "").toLowerCase();
}

function formatIntroParticipants(introCase: DashboardIntroCase) {
  return introCase.participants.length > 0 ? introCase.participants.join(" ↔ ") : "참여자 정보 없음";
}

function IntroStatusBadge({ status }: { status: DashboardIntroCase["status"] }) {
  const className =
    status === "MATCHED" || status === "CONNECTED" || status === "SUCCESS"
      ? "bg-emerald-50 text-emerald-700"
      : status === "DECLINED" || status === "FAILED" || status === "CANCELLED"
        ? "bg-zinc-100 text-zinc-600"
        : "bg-[#fff1e6] text-[#c96a2b]";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{introStatusLabels[status]}</span>;
}
