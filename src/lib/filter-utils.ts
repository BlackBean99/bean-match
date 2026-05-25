import { introStatusLabels, userStatusLabels, type IntroStatus, type MemberFilterState, type UserStatus } from "@/lib/domain";

export type SearchParamMap = Record<string, string | string[] | undefined>;

type ParseMemberFilterOptions = {
  defaultStatus?: MemberFilterState["status"];
};

export function parseMemberFilters(searchParams: SearchParamMap, options: ParseMemberFilterOptions = {}): MemberFilterState {
  const defaultStatus = options.defaultStatus ?? "ALL";

  return {
    view: readFilter(searchParams.view, ["pool", "recommend", "graph"], "pool"),
    recommendationFor: readString(searchParams.recommendationFor),
    introStatus: readFilter(searchParams.introStatus, ["ALL", ...introStatusOptions], "ALL"),
    status: readFilter(searchParams.status, ["ALL", ...statusOptions], defaultStatus),
    gender: readFilter(searchParams.gender, ["ALL", "FEMALE", "MALE", "OTHER", "UNDISCLOSED"], "ALL"),
    ageMin: readString(searchParams.ageMin),
    ageMax: readString(searchParams.ageMax),
    heightMin: readString(searchParams.heightMin),
    heightMax: readString(searchParams.heightMax),
    sort: readFilter(
      searchParams.sort,
      ["updated_desc", "name_asc", "age_asc", "age_desc", "height_asc", "height_desc", "gender_asc"],
      "updated_desc",
    ),
  };
}

const introStatusOptions = Object.keys(introStatusLabels) as IntroStatus[];
const statusOptions = Object.keys(userStatusLabels) as UserStatus[];

function readString(value: string | string[] | undefined) {
  const resolvedValue = Array.isArray(value) ? value[0] : value;
  return resolvedValue?.trim() ?? "";
}

function readFilter<T extends string>(value: string | string[] | undefined, allowed: T[], fallback: T) {
  const resolvedValue = readString(value);
  return allowed.includes(resolvedValue as T) ? (resolvedValue as T) : fallback;
}
