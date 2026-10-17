export interface ConversationLine {
  speaker: 'medrzec' | 'player' | string;
  text: string;
}

export interface QuizInteractionData {
  title: string;
  avatar?: string;
  context: string;
  sageMessage?: string;
  optionA: string;
  optionB: string;
  correctOption: 'A' | 'B';
  goodFeedback: string;
  badFeedback: string;
  onSuccess?: () => void;
}

export class InteractionDialog {
  public isOpen: boolean = false;

  private overlayElement: HTMLElement;
  private containerElement: HTMLElement;
  private avatarBox: HTMLElement;
  private avatarImg: HTMLImageElement;
  private panelElement: HTMLElement;
  private titleElement: HTMLElement;
  private speakerElement: HTMLElement;
  private bodyElement: HTMLElement;
  private choicesContainer: HTMLElement;
  private choiceA: HTMLElement;
  private choiceB: HTMLElement;
  private hintElement: HTMLElement;

  // Typewriter state
  private fullText: string = '';
  private currentPages: string[] = [];
  private currentPageIndex: number = 0;
  private typedChars: number = 0;
  private isDoneTyping: boolean = true;
  private typingSpeed: number = 36; // characters per second
  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;

  // Quiz state
  private mode: 'conversation' | 'quiz' = 'conversation';
  private quizData: QuizInteractionData | null = null;
  private quizStage: 'context' | 'sage' | 'choices' | 'feedback' = 'context';
  private selectedChoice: 'A' | 'B' = 'A';
  private lastChoiceCorrect: boolean = false;

  // Conversation state (Old Sage / Player talks)
  private conversationItems: ConversationLine[] = [];
  private conversationIndex: number = 0;
  private playerEvoLevel: number = 1;
  private onCompleteCallback?: () => void;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'retro-dialog-overlay hidden';

    this.containerElement = document.createElement('div');
    this.containerElement.className = 'retro-dialog-container';

    // Left Avatar Box
    this.avatarBox = document.createElement('div');
    this.avatarBox.className = 'retro-avatar-box';
    this.avatarImg = document.createElement('img');
    this.avatarImg.className = 'retro-avatar-img';
    this.avatarBox.appendChild(this.avatarImg);

    // Right Dialog Panel
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'retro-panel-box';

    this.titleElement = document.createElement('div');
    this.titleElement.className = 'retro-dialog-title';

    this.speakerElement = document.createElement('div');
    this.speakerElement.className = 'retro-dialog-speaker';

    this.bodyElement = document.createElement('div');
    this.bodyElement.className = 'retro-dialog-body';

    this.choicesContainer = document.createElement('div');
    this.choicesContainer.className = 'retro-dialog-choices hidden';

    this.choiceA = document.createElement('div');
    this.choiceA.className = 'retro-choice-btn';
    this.choiceA.onclick = (e) => {
      e.stopPropagation();
      this.selectedChoice = 'A';
      this.renderChoices();
      this.confirmChoice();
    };

    this.choiceB = document.createElement('div');
    this.choiceB.className = 'retro-choice-btn';
    this.choiceB.onclick = (e) => {
      e.stopPropagation();
      this.selectedChoice = 'B';
      this.renderChoices();
      this.confirmChoice();
    };

    this.choicesContainer.appendChild(this.choiceA);
    this.choicesContainer.appendChild(this.choiceB);

    this.hintElement = document.createElement('div');
    this.hintElement.className = 'retro-dialog-hint';

    this.panelElement.appendChild(this.titleElement);
    this.panelElement.appendChild(this.speakerElement);
    this.panelElement.appendChild(this.bodyElement);
    this.panelElement.appendChild(this.choicesContainer);
    this.panelElement.appendChild(this.hintElement);

    this.containerElement.appendChild(this.avatarBox);
    this.containerElement.appendChild(this.panelElement);

    this.overlayElement.appendChild(this.containerElement);
    container.appendChild(this.overlayElement);

    // Click / touch to advance
    this.overlayElement.addEventListener('click', () => {
      if (!this.isOpen) return;
      if (this.mode === 'quiz' && this.quizStage === 'choices') return;
      this.advance();
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.advance();
      } else if (this.mode === 'quiz' && this.quizStage === 'choices') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Digit1') {
          e.preventDefault();
          this.selectedChoice = 'A';
          this.renderChoices();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'Digit2') {
          e.preventDefault();
          this.selectedChoice = 'B';
          this.renderChoices();
        }
      }
    });
  }

  public setPlayerEvo(evo: number): void {
    this.playerEvoLevel = Math.max(1, Math.min(5, evo));
  }

  public updatePosition(playerY: number): void {
    if (playerY < 448) {
      this.containerElement.classList.add('position-bottom');
      this.containerElement.classList.remove('position-top');
    } else {
      this.containerElement.classList.add('position-top');
      this.containerElement.classList.remove('position-bottom');
    }
  }

  /**
   * Start conversation sequence (e.g. Sage intro dialog or world summary)
   * 1:1 with Python prototype: pinned to TOP of the screen, with Sage/Player avatar!
   */
  public startConversation(
    title: string,
    lines: ConversationLine[],
    evo: number = 1,
    _playerY: number = 600,
    onComplete?: () => void
  ): void {
    if (!lines || lines.length === 0) return;
    this.avatarBox.style.display = '';
    this.containerElement.classList.add('position-top');
    this.containerElement.classList.remove('position-bottom');
    this.mode = 'conversation';

    this.titleElement.textContent = title;
    this.conversationItems = lines;
    this.conversationIndex = 0;
    this.playerEvoLevel = evo;
    this.onCompleteCallback = onComplete;
    this.isOpen = true;
    this.choicesContainer.classList.add('hidden');
    this.overlayElement.classList.remove('hidden');

    this.showConversationLine(0);
  }

  /**
   * Start World Intro narrative dialogue (1:1 with Python line 3278: text panel WITHOUT avatar!)
   */
  public startWorldIntro(title: string, text: string, onComplete?: () => void): void {
    this.mode = 'conversation';
    this.titleElement.textContent = `${title} — Wstęp`;
    this.speakerElement.textContent = '';
    this.avatarBox.style.display = 'none'; // NO avatar box!
    this.containerElement.classList.add('position-top');
    this.containerElement.classList.remove('position-bottom');

    this.conversationItems = [{ speaker: '', text }];
    this.conversationIndex = 0;
    this.onCompleteCallback = () => {
      this.avatarBox.style.display = '';
      if (onComplete) onComplete();
    };

    this.isOpen = true;
    this.choicesContainer.classList.add('hidden');
    this.overlayElement.classList.remove('hidden');

    this.startTypewriter(text);
  }

  /**
   * Start Boss Intro dialogue (1:1 with Python line 2300 & 3294: Boss avatar + panel with intro text)
   */
  public startBossIntro(bossName: string, introText: string, wn: number, onComplete?: () => void): void {
    this.mode = 'conversation';
    this.titleElement.textContent = `${bossName} — Wstęp`;
    this.speakerElement.textContent = `${bossName}:`;
    this.speakerElement.style.color = '#ff9999';
    this.avatarBox.style.display = '';
    this.avatarImg.src = `/assets/avatars/boss${wn}.png`;
    this.avatarImg.onerror = () => {
      this.avatarImg.src = `/assets/avatars/boss1.png`;
    };
    this.containerElement.classList.add('position-top');
    this.containerElement.classList.remove('position-bottom');

    this.conversationItems = [{ speaker: bossName, text: introText }];
    this.conversationIndex = 0;
    this.onCompleteCallback = () => {
      if (onComplete) onComplete();
    };

    this.isOpen = true;
    this.choicesContainer.classList.add('hidden');
    this.overlayElement.classList.remove('hidden');

    this.startTypewriter(introText);
  }

  private showConversationLine(index: number): void {
    if (index >= this.conversationItems.length) {
      this.close();
      if (this.onCompleteCallback) this.onCompleteCallback();
      return;
    }

    const cur = this.conversationItems[index];
    const spk = (cur.speaker || 'medrzec').toLowerCase();
    const isPlayer = spk === 'player' || spk === 'gracz';

    // Set speaker label
    this.speakerElement.textContent = isPlayer ? 'Bohater:' : 'Mędrzec:';
    this.speakerElement.style.color = isPlayer ? '#b4d2ff' : '#ffe6b4';

    // Set avatar
    if (isPlayer) {
      this.avatarImg.src = `/assets/avatars/player${this.playerEvoLevel}.png`;
    } else {
      this.avatarImg.src = '/assets/avatars/medrzec.png';
    }

    this.startTypewriter(cur.text);
  }

  /**
   * Start multi-stage interactive quiz with NPC
   */
  public startQuiz(data: QuizInteractionData, evo: number = 1, playerY: number = 600): void {
    this.updatePosition(playerY);
    this.mode = 'quiz';
    this.quizData = data;
    this.quizStage = 'context';
    this.selectedChoice = 'A';
    this.playerEvoLevel = evo;
    this.isOpen = true;
    this.titleElement.textContent = data.title;
    this.overlayElement.classList.remove('hidden');

    this.showQuizStage('context');
  }

  private showQuizStage(stage: 'context' | 'sage' | 'choices' | 'feedback', feedbackText?: string): void {
    if (!this.quizData) return;
    this.quizStage = stage;

    if (stage === 'context') {
      this.choicesContainer.classList.add('hidden');
      const avName = (this.quizData.avatar || 'mail').toLowerCase().trim();
      const safeAvatar = encodeURIComponent(avName).replace(/%2F/g, '/');
      this.avatarImg.src = `/assets/avatars/${safeAvatar}.png`;
      this.avatarImg.onerror = () => {
        this.avatarImg.src = `/assets/avatars/player${this.playerEvoLevel}.png`;
      };
      this.speakerElement.textContent = 'Zdarzenie:';
      this.speakerElement.style.color = '#b4d2ff';
      this.startTypewriter(this.quizData.context);
    } else if (stage === 'sage') {
      this.choicesContainer.classList.add('hidden');
      this.avatarImg.src = '/assets/avatars/medrzec.png';
      this.speakerElement.textContent = 'Wskazówka Mędrca:';
      this.speakerElement.style.color = '#ffe6b4';
      this.startTypewriter(this.quizData.sageMessage || 'Zachowaj czujność.');
    } else if (stage === 'choices') {
      this.avatarImg.src = `/assets/avatars/player${this.playerEvoLevel}.png`;
      this.speakerElement.textContent = 'Wybierz reakcję:';
      this.speakerElement.style.color = '#b4d2ff';
      // In Python original: The story context/question remains visible above the choices!
      if (this.quizData) {
        this.bodyElement.textContent = this.quizData.context;
      }
      this.choicesContainer.classList.remove('hidden');
      this.renderChoices();
      this.hintElement.textContent = '↑/↓ lub 1/2 — wybór, Enter/Spacja/E — zatwierdź';
      this.isDoneTyping = true;
    } else if (stage === 'feedback') {
      this.choicesContainer.classList.add('hidden');
      const isGood = feedbackText === this.quizData.goodFeedback;
      this.avatarImg.src = '/assets/avatars/medrzec.png';
      this.speakerElement.textContent = isGood ? '✓ Poprawny wybór:' : '✗ Błędna decyzja:';
      this.speakerElement.style.color = isGood ? '#4ade80' : '#f87171';
      this.hintElement.textContent = isGood ? 'ENTER aby przejść dalej' : 'ENTER aby spróbować ponownie';
      this.startTypewriter(feedbackText || '');
    }
  }

  private renderChoices(): void {
    if (!this.quizData) return;
    this.choiceA.textContent = `A. ${this.quizData.optionA}`;
    this.choiceB.textContent = `B. ${this.quizData.optionB}`;

    this.choiceA.classList.toggle('selected', this.selectedChoice === 'A');
    this.choiceB.classList.toggle('selected', this.selectedChoice === 'B');
  }

  private confirmChoice(): void {
    if (!this.quizData) return;
    this.lastChoiceCorrect = (this.selectedChoice === this.quizData.correctOption);
    const fb = this.lastChoiceCorrect ? this.quizData.goodFeedback : this.quizData.badFeedback;

    if (this.lastChoiceCorrect && this.quizData.onSuccess) {
      this.quizData.onSuccess();
    }

    this.showQuizStage('feedback', fb);
  }

  public advance(): void {
    // If typewriter is still typing, finish instantly (force done)
    if (!this.isDoneTyping) {
      this.forceFinishTyping();
      return;
    }

    // If there is another page in the current text block, go to next page
    if (this.currentPageIndex < this.currentPages.length - 1) {
      this.currentPageIndex++;
      this.startPageTyping();
      return;
    }

    // In conversation mode: move to next dialog line
    if (this.mode === 'conversation') {
      this.conversationIndex++;
      this.showConversationLine(this.conversationIndex);
      return;
    }

    // In quiz mode: advance through stages
    if (this.mode === 'quiz') {
      if (this.quizStage === 'context') {
        if (this.quizData?.sageMessage && this.quizData.sageMessage.trim().length > 0) {
          this.showQuizStage('sage');
        } else {
          this.showQuizStage('choices');
        }
      } else if (this.quizStage === 'sage') {
        this.showQuizStage('choices');
      } else if (this.quizStage === 'choices') {
        this.confirmChoice();
      } else if (this.quizStage === 'feedback') {
        if (this.lastChoiceCorrect) {
          this.close();
        } else {
          // 1:1 with Python prototype: wrong answer does NOT exit the interaction;
          // it returns back to the choices so the player can re-read and answer correctly!
          this.showQuizStage('choices');
        }
      }
    }
  }

  private startTypewriter(text: string): void {
    this.fullText = text.replace(/\\n/g, '\n');
    this.currentPages = this.fullText.split(/\s*---\s*/);
    if (this.currentPages.length === 0) this.currentPages = [''];
    this.currentPageIndex = 0;
    this.startPageTyping();
  }

  private startPageTyping(): void {
    this.typedChars = 0;
    this.isDoneTyping = false;
    this.hintElement.textContent = '';
    this.lastTimestamp = performance.now();

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const tick = (now: number) => {
      const dt = Math.min((now - this.lastTimestamp) / 1000, 0.05);
      this.lastTimestamp = now;

      const page = this.currentPages[this.currentPageIndex] || '';
      this.typedChars += this.typingSpeed * dt;

      if (this.typedChars >= page.length) {
        this.typedChars = page.length;
        this.bodyElement.textContent = page;
        this.isDoneTyping = true;
        this.hintElement.textContent = 'ENTER aby przejść dalej';
      } else {
        this.bodyElement.textContent = page.substring(0, Math.floor(this.typedChars));
        this.animFrameId = requestAnimationFrame(tick);
      }
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private forceFinishTyping(): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    const page = this.currentPages[this.currentPageIndex] || '';
    this.typedChars = page.length;
    this.bodyElement.textContent = page;
    this.isDoneTyping = true;
    this.hintElement.textContent = 'ENTER aby przejść dalej';
  }

  public close(): void {
    this.isOpen = false;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.overlayElement.classList.add('hidden');
    this.choicesContainer.classList.add('hidden');
    this.avatarBox.style.display = '';
    this.bodyElement.textContent = '';
    this.hintElement.textContent = '';
  }
}
