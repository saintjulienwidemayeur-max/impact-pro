/** Small built-in deny list (lower-case). Checked after normalising; not a substitute for a breach-corpus check. */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  `password password1 password12 password123 password1234 passw0rd p@ssw0rd p@ssword motdepasse motdepasse1 motdepasse123
  azerty azertyuiop azerty123 azerty1234 azertyuiop123 qwerty qwerty123 qwertyuiop qwerty1234 qwertyuiop123 1234567890 12345678910
  0123456789 1234567890123 123456789012 1q2w3e4r5t 1q2w3e4r 1qaz2wsx 1qaz2wsx3edc zaq12wsx qazwsxedc qazwsxedcrfv
  iloveyou iloveyou1 iloveyou123 welcome welcome1 welcome123 admin admin123 admin1234 administrator letmein letmein123
  monkey123 dragon123 football football123 baseball123 sunshine sunshine1 princess princess1 superman superman1 batman123
  abc123456 abcd1234 abcd12345 abcdef123 abcdefghij aaaaaaaaaa 0000000000 1111111111 1212121212 123123123123 123456123456
  changeme changeme123 default123 test123456 testtest123 testing123 trustno1 master123 shadow123 michael123 jessica123
  ayiti ayiti123 haiti haiti123 haiti2024 haiti2025 haiti2026 ayiti2024 ayiti2025 ayiti2026 impactpro impactpro1 impactpro123
  impact123 impactpro2026 bonjour123 bonjour1234 bonsoir123 mapassword motdepasse2026 motdepasse2025 password2025 password2026
  miami123 miami2026 football2026 jesus123 jesuschrist god123456 godisgood godisgood1 mwenaimeou`
    .split(/\s+/)
    .filter(Boolean),
);
