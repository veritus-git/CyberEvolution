export interface QuizData {
  id: number;
  avatar?: string;
  context: string;
  sageMessage: string;
  optionA: string;
  optionB: string;
  correctOption: 'A' | 'B';
  goodFeedback: string;
  badFeedback: string;
  speedContext?: number;
  speedSage?: number;
  speedFeedback?: number;
}

export class InteractionParser {
  /**
   * Parse interactions.txt into structured QuizData array.
   */
  public static parse(content: string): QuizData[] {
    const blocks = content.split(/\n\s*---\s*\n/);
    const quizzes: QuizData[] = [];
    let idCounter = 1;

    for (const block of blocks) {
      const lines = block.split('\n');
      let avatar: string | undefined;
      let context = '';
      let sage = '';
      let optA = '';
      let optB = '';
      let correct: 'A' | 'B' = 'B';
      let good = 'Poprawna odpowiedź!';
      let bad = 'Niestety to zły wybór. Spróbuj ponownie.';

      let currentKey: string | null = null;
      let currentValue: string = '';

      const flushKey = () => {
        if (!currentKey) return;
        const val = currentValue.trim().replace(/\\n/g, '\n');
        switch (currentKey) {
          case 'AVATAR': avatar = val; break;
          case 'CONTEXT': context = val; break;
          case 'SAGE': sage = val; break;
          case 'A': optA = val; break;
          case 'B': optB = val; break;
          case 'CORRECT': correct = val.toUpperCase().includes('A') ? 'A' : 'B'; break;
          case 'GOOD': good = val; break;
          case 'BAD': bad = val; break;
        }
      };

      for (const rawLine of lines) {
        const line = rawLine.trimEnd();
        if (line.trim().startsWith('#') || line.trim() === '') continue;

        const match = line.match(/^([A-Z_]+):\s*(.*)$/);
        if (match) {
          flushKey();
          currentKey = match[1];
          currentValue = match[2];
        } else if (currentKey) {
          currentValue += '\n' + line.trim();
        }
      }
      flushKey();

      if (context && optA && optB) {
        quizzes.push({
          id: idCounter++,
          avatar,
          context,
          sageMessage: sage,
          optionA: optA,
          optionB: optB,
          correctOption: correct,
          goodFeedback: good,
          badFeedback: bad,
        });
      }
    }

    return quizzes;
  }

  public static async loadFromFile(url: string): Promise<QuizData[]> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      return this.parse(text);
    } catch (e) {
      console.warn(`Failed to load interactions from ${url}:`, e);
      return [];
    }
  }
}
