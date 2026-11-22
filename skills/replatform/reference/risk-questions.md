# Risk questions

The wizard's eight risk questions and three EU AI Act questions, from the Wizard's question
catalogue (version 0.1.0) in the platform repo. Answers **suggest** a zone; the strictest answer
wins. A person confirms the zone; the agent never sets it.

Answer from evidence in the code where you can (a `users` table with e-mail addresses answers Q2),
and ask the owner for the rest. Record the evidence for each answer in the plan.

| # | Question | If yes |
|---|---|---|
| Q1 | Will people outside your organisation use it? | At least Yellow |
| Q2 | Will it read or store personal data, including employee data? | Red (Yellow means no personal data) |
| Q3 | Health, biometric, religious, trade-union or children's data? | Red, plus a DPIA record |
| Q4 | Is the data covered by sector rules: NIS2, DORA, finance or public-sector law? | Red |
| Q5 | Will the AI make or shape decisions about people? | Red, plus an EU AI Act high-risk check |
| Q6 | Will the AI act in other systems: write, send, pay, delete? | Every write tool needs a person's approval at every zone |
| Q7 | Must the data stay in the EU or in Sweden? | EU Data Zone models and EU regions only; Claude only with consent |
| Q8 | Must it be reachable from the internet? | Stage and prod behind a WAF in Prevention, or internal-only; Yellow prod adds an IP allow-list |

## EU AI Act

| # | Question | If yes |
|---|---|---|
| A1 | Does the AI score social behaviour, manipulate people in ways they cannot notice, or identify people by biometrics in public spaces? | Prohibited (Article 5). **Stop** and tell the owner |
| A2 | Hiring, credit, education, essential services, law enforcement or another high-risk use? | High-risk: Red, a DPIA and an AI Act record before build, human approval on every decision |
| A3 | Will people chat with it, or see text, images or audio it generates? | Transparency duty (Article 50): users are told they deal with AI |

## Evidence hints

| Look for | Suggests |
|---|---|
| Sign-up pages, public routes without auth, CORS `*` | Q1, Q8 |
| Tables or models with name, e-mail, phone, personal number (`personnummer`), address | Q2 |
| Fields for diagnosis, health, union, religion, birth date of minors | Q3 |
| Payment, banking, insurance, municipality or authority domains | Q4 |
| Scoring, ranking or approval logic about people, especially with an LLM in the loop | Q5 |
| Outbound e-mail, payments, deletes or writes to other systems triggered by AI | Q6 |
| Customer contract or README mentions residency | Q7 |
