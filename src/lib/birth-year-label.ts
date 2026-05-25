type AgeLike = {
  age: number;
  ageText?: string | null;
};

export function formatBirthYearLabel(person: AgeLike) {
  const birthYear = normalizeBirthYearText(person.ageText, person.age);
  if (birthYear) return `${birthYear}년생`;
  if (person.age > 0) return `${person.age}세`;
  if (person.ageText) return person.ageText;
  return "나이 비공개";
}

function normalizeBirthYearText(ageText: string | null | undefined, age: number) {
  if (!ageText) return null;

  const match = ageText.match(/\d+/);
  if (!match) return null;

  const token = match[0];
  if (token.length >= 6) {
    if (token.startsWith("19") || token.startsWith("20")) {
      return token.slice(2, 4);
    }
    return token.slice(0, 2);
  }

  if (token.length === 4) {
    return token.slice(-2);
  }

  if (age > 0 && Number(token) === age) {
    return null;
  }

  return token.padStart(2, "0");
}
