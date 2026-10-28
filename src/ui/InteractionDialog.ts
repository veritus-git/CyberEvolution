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
  public get isChoicesVisible(): boolean {
    return (this.isOpen && this.mode === 'quiz' && this.quizStage === 'choices') || this.isDeathMenuActive;
  }

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

  // Death Menu state (1:1 with Python prototype: Retry Boss vs Restart World)
  private deathMenuOverlay: HTMLElement;
  private deathMenuElement: HTMLElement;
  private deathMenuTitle: HTMLElement;
  private deathMenuOpt0: HTMLElement;
  private deathMenuOpt1: HTMLElement;
  private isDeathMenuActive: boolean = false;
  private deathMenuSelection: number = 0;
  private onRetryBossCallback?: () => void;
  private onRestartWorldCallback?: () => void;

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

    // Yellow event titles like "wstep" / "Świat 1: Miasto iluzji" removed per requirements
    this.titleElement.style.display = 'none';

    this.panelElement.appendChild(this.speakerElement);
    this.panelElement.appendChild(this.bodyElement);
    this.panelElement.appendChild(this.choicesContainer);
    this.panelElement.appendChild(this.hintElement);

    this.containerElement.appendChild(this.avatarBox);
    this.containerElement.appendChild(this.panelElement);

    this.overlayElement.appendChild(this.containerElement);

    // Dedicated Death menu overlay (completely independent of retro-dialog-overlay!)
    this.deathMenuOverlay = document.createElement('div');
    this.deathMenuOverlay.className = 'death-menu-overlay hidden';
    this.deathMenuOverlay.style.display = 'none';

    this.deathMenuElement = document.createElement('div');
    this.deathMenuElement.className = 'death-menu-panel';

    this.deathMenuTitle = document.createElement('div');
    this.deathMenuTitle.className = 'death-menu-title';
    this.deathMenuTitle.textContent = 'Przegrałeś';

    this.deathMenuOpt0 = document.createElement('div');
    this.deathMenuOpt0.className = 'death-menu-option selected';
    this.deathMenuOpt0.textContent = 'Walcz ponownie';
    this.deathMenuOpt0.onmouseenter = () => {
      this.deathMenuSelection = 0;
      this.renderDeathMenu();
    };
    this.deathMenuOpt0.onclick = (e) => {
      e.stopPropagation();
      this.confirmDeathMenu(0);
    };

    this.deathMenuOpt1 = document.createElement('div');
    this.deathMenuOpt1.className = 'death-menu-option';
    this.deathMenuOpt1.textContent = 'Przejdź świat jeszcze raz';
    this.deathMenuOpt1.onmouseenter = () => {
      this.deathMenuSelection = 1;
      this.renderDeathMenu();
    };
    this.deathMenuOpt1.onclick = (e) => {
      e.stopPropagation();
      this.confirmDeathMenu(1);
    };

    this.deathMenuElement.appendChild(this.deathMenuTitle);
    this.deathMenuElement.appendChild(this.deathMenuOpt0);
    this.deathMenuElement.appendChild(this.deathMenuOpt1);
    this.deathMenuOverlay.appendChild(this.deathMenuElement);

    container.appendChild(this.overlayElement);
    container.appendChild(this.deathMenuOverlay);

    // Click / touch to advance
    this.overlayElement.addEventListener('click', () => {
      if (!this.isOpen) return;
      if (this.isDeathMenuActive) return;
      if (this.mode === 'quiz' && this.quizStage === 'choices') return;
      this.advance();
    });

    // Global tap/click anywhere on screen to advance dialogue
    window.addEventListener('pointerdown', (e) => {
      if (!this.isOpen) return;
      if (this.isDeathMenuActive) return;
      if (this.mode === 'quiz' && this.quizStage === 'choices') return;

      const target = e.target as HTMLElement | null;
      if (target && (target.closest('.retro-choice-btn') || target.closest('.death-menu-option') || target.closest('#btn-fullscreen') || target.closest('#sound-control-wrapper') || target.closest('.sound-popup'))) {
        return;
      }
      this.advance();
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;

      if (this.isDeathMenuActive) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'ArrowLeft' || e.code === 'Digit1') {
          e.preventDefault();
          this.deathMenuSelection = 0;
          this.renderDeathMenu();
        } else if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ArrowRight' || e.code === 'Digit2') {
          e.preventDefault();
          this.deathMenuSelection = 1;
          this.renderDeathMenu();
        } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
          e.preventDefault();
          this.confirmDeathMenu(this.deathMenuSelection);
        }
        return;
      }

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

  private swapChoices: boolean = false;

  private hideChoices(): void {
    this.choicesContainer.classList.add('hidden');
    this.choicesContainer.style.setProperty('display', 'none', 'important');
    this.choiceA.textContent = '';
    this.choiceB.textContent = '';
  }

  private showChoices(): void {
    this.choicesContainer.classList.remove('hidden');
    this.choicesContainer.style.setProperty('display', 'flex', 'important');
    this.renderChoices();
  }

  public setPlayerEvo(evo: number): void {
    this.playerEvoLevel = Math.max(1, Math.min(5, evo));
  }

  public updatePosition(playerY: number): void {
    this.containerElement.classList.remove('position-center');
    if (playerY < 448) {
      this.containerElement.classList.add('position-bottom');
      this.containerElement.classList.remove('position-top');
    } else {
      this.containerElement.classList.add('position-top');
      this.containerElement.classList.remove('position-bottom');
    }
  }

  private adjustBodyFontSize(text: string, isCompact: boolean): void {
    this.bodyElement.classList.remove('font-xlarge', 'font-compact', 'font-dense');
    if (isCompact) {
      if (text.length > 200) {
        this.bodyElement.classList.add('font-dense');
      } else {
        this.bodyElement.classList.add('font-compact');
      }
    } else {
      if (text.length < 80) {
        this.bodyElement.classList.add('font-xlarge');
      } else if (text.length > 260) {
        this.bodyElement.classList.add('font-compact');
      }
    }
  }

  /**
   * Start conversation sequence (e.g. Sage intro dialog or world summary)
   * Pinned to TOP or centered depending on style
   */
  public startConversation(
    title: string,
    lines: ConversationLine[],
    evo: number = 1,
    _playerY: number = 600,
    onComplete?: () => void
  ): void {
    if (!lines || lines.length === 0) return;
    this.resetDeathMenu();
    this.containerElement.style.display = '';
    this.overlayElement.style.display = '';
    this.avatarBox.style.display = '';
    this.containerElement.classList.remove('position-bottom', 'position-center');
    this.containerElement.classList.add('position-top');
    this.overlayElement.classList.remove('dark-backdrop');
    this.mode = 'conversation';

    this.titleElement.textContent = title;
    this.conversationItems = lines;
    this.conversationIndex = 0;
    this.playerEvoLevel = evo;
    this.onCompleteCallback = onComplete;
    this.isOpen = true;
    this.hideChoices();
    this.overlayElement.classList.remove('hidden');

    this.showConversationLine(0);
  }

  /**
   * Start World Intro narrative dialogue (1:1 with Python: Centered on screen, dark backdrop, Sage avatar for worlds 1-4)
   */
  public startWorldIntro(title: string, text: string, wn: number = 1, onComplete?: () => void): void {
    this.resetDeathMenu();
    this.containerElement.style.display = '';
    this.overlayElement.style.display = '';
    this.mode = 'conversation';
    this.titleElement.textContent = `${title} - Wstęp`;
    this.speakerElement.textContent = '';
    
    // Worlds 1-4 show Sage avatar; World 5 has no avatar (empty)
    if (wn === 5) {
      this.avatarBox.style.display = 'none';
    } else {
      this.avatarBox.style.display = '';
      this.avatarImg.src = '/assets/avatars/medrzec.png';
    }

    this.containerElement.classList.remove('position-top', 'position-bottom');
    this.containerElement.classList.add('position-center');
    this.overlayElement.classList.add('dark-backdrop');

    this.conversationItems = [{ speaker: '', text }];
    this.conversationIndex = 0;
    this.onCompleteCallback = () => {
      this.avatarBox.style.display = '';
      this.containerElement.classList.remove('position-center');
      this.overlayElement.classList.remove('dark-backdrop');
      if (onComplete) onComplete();
    };

    this.isOpen = true;
    this.hideChoices();
    this.overlayElement.classList.remove('hidden');

    this.startTypewriter(text);
  }

  /**
   * Start Boss Intro dialogue (1:1 with Python: Centered on screen, dark backdrop, Boss avatar)
   */
  public startBossIntro(bossName: string, introText: string, wn: number, onComplete?: () => void, stageTitle?: string): void {
    this.resetDeathMenu();
    this.containerElement.style.display = '';
    this.overlayElement.style.display = '';
    this.mode = 'conversation';
    this.titleElement.textContent = stageTitle ? `${bossName} - ${stageTitle}` : `${bossName} - Wstęp`;
    this.speakerElement.textContent = `${bossName}:`;
    this.speakerElement.style.color = '#ff9999';
    this.avatarBox.style.display = '';
    this.avatarImg.src = `/assets/avatars/boss${wn}.png`;
    this.avatarImg.onerror = () => {
      this.avatarImg.src = `/assets/avatars/boss1.png`;
    };

    this.containerElement.classList.remove('position-top', 'position-bottom');
    this.containerElement.classList.add('position-center');
    this.overlayElement.classList.add('dark-backdrop');

    this.conversationItems = [{ speaker: bossName, text: introText }];
    this.conversationIndex = 0;
    this.onCompleteCallback = () => {
      this.containerElement.classList.remove('position-center');
      this.overlayElement.classList.remove('dark-backdrop');
      if (onComplete) onComplete();
    };

    this.isOpen = true;
    this.hideChoices();
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

    this.adjustBodyFontSize(cur.text, false);
    this.startTypewriter(cur.text);
  }

  /**
   * Start multi-stage interactive quiz with NPC
   */
  public startQuiz(data: QuizInteractionData, evo: number = 1, playerY: number = 600): void {
    this.resetDeathMenu();
    this.containerElement.style.display = '';
    this.overlayElement.style.display = '';
    this.updatePosition(playerY);
    this.mode = 'quiz';
    this.quizData = data;
    this.quizStage = 'context';
    this.selectedChoice = 'A';
    this.playerEvoLevel = evo;
    this.swapChoices = Math.random() < 0.5; // True 50/50 randomize choice positions!
    this.isOpen = true;
    this.titleElement.textContent = data.title;
    this.overlayElement.classList.remove('hidden');
    this.overlayElement.classList.remove('dark-backdrop');

    this.showQuizStage('context');
  }

  private showQuizStage(stage: 'context' | 'sage' | 'choices' | 'feedback', feedbackText?: string): void {
    if (!this.quizData) return;
    this.quizStage = stage;

    if (stage === 'context') {
      this.hideChoices();
      const avName = (this.quizData.avatar || 'mail').toLowerCase().trim();
      const safeAvatar = encodeURIComponent(avName).replace(/%2F/g, '/');
      this.avatarImg.src = `/assets/avatars/${safeAvatar}.png`;
      this.avatarImg.onerror = () => {
        this.avatarImg.src = `/assets/avatars/player${this.playerEvoLevel}.png`;
      };
      this.speakerElement.textContent = 'Zdarzenie:';
      this.speakerElement.style.color = '#b4d2ff';
      this.adjustBodyFontSize(this.quizData.context, false);
      this.startTypewriter(this.quizData.context);
    } else if (stage === 'sage') {
      this.hideChoices();
      this.avatarImg.src = '/assets/avatars/medrzec.png';
      this.speakerElement.textContent = 'Wskazówka Mędrca:';
      this.speakerElement.style.color = '#ffe6b4';
      const sageMsg = this.quizData.sageMessage || 'Zachowaj czujność.';
      this.adjustBodyFontSize(sageMsg, false);
      this.startTypewriter(sageMsg);
    } else if (stage === 'choices') {
      this.avatarImg.src = `/assets/avatars/player${this.playerEvoLevel}.png`;
      this.speakerElement.textContent = 'Wybierz reakcję:';
      this.speakerElement.style.color = '#b4d2ff';
      // In Python original: The story context/question remains visible above the choices!
      if (this.quizData) {
        this.adjustBodyFontSize(this.quizData.context, true);
        this.bodyElement.textContent = this.quizData.context;
      }
      this.showChoices();
      const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
      this.hintElement.textContent = isTouch ? 'Dotknij wybranej opcji' : '↑/↓ lub 1/2 - wybór, Enter/Spacja/E - zatwierdź';
      this.isDoneTyping = true;
      document.body.classList.remove('cursor-hidden');
    } else if (stage === 'feedback') {
      this.hideChoices();
      const isGood = feedbackText === this.quizData.goodFeedback;
      this.avatarImg.src = '/assets/avatars/medrzec.png';
      this.speakerElement.textContent = isGood ? '✓ Poprawny wybór:' : '✗ Błędna decyzja:';
      this.speakerElement.style.color = isGood ? '#4ade80' : '#f87171';
      const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
      if (isGood) {
        this.hintElement.textContent = isTouch ? 'Dotknij ekranu, aby przejść dalej' : 'ENTER aby przejść dalej';
      } else {
        this.hintElement.textContent = isTouch ? 'Dotknij ekranu, aby spróbować ponownie' : 'ENTER aby spróbować ponownie';
      }
      const fb = feedbackText || '';
      this.adjustBodyFontSize(fb, false);
      this.startTypewriter(fb);
    }
  }

  private renderChoices(): void {
    if (!this.quizData) return;
    const textA = this.swapChoices ? this.quizData.optionB : this.quizData.optionA;
    const textB = this.swapChoices ? this.quizData.optionA : this.quizData.optionB;

    this.choiceA.textContent = `A. ${textA}`;
    this.choiceB.textContent = `B. ${textB}`;

    this.choiceA.classList.toggle('selected', this.selectedChoice === 'A');
    this.choiceB.classList.toggle('selected', this.selectedChoice === 'B');
  }

  private confirmChoice(): void {
    if (!this.quizData) return;
    const chosenText = this.selectedChoice === 'A'
      ? (this.swapChoices ? this.quizData.optionB : this.quizData.optionA)
      : (this.swapChoices ? this.quizData.optionA : this.quizData.optionB);
    const correctText = this.quizData.correctOption === 'A' ? this.quizData.optionA : this.quizData.optionB;
    this.lastChoiceCorrect = (chosenText === correctText);
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
        const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
        this.hintElement.textContent = isTouch ? 'Dotknij ekranu, aby przejść dalej' : 'ENTER aby przejść dalej';
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
    const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));
    this.hintElement.textContent = isTouch ? 'Dotknij ekranu, aby przejść dalej' : 'ENTER aby przejść dalej';
  }

  private resetDeathMenu(): void {
    this.isDeathMenuActive = false;
    this.deathMenuOverlay.classList.add('hidden');
    this.deathMenuOverlay.style.display = 'none';
  }

  public showDeathMenu(onRetryBoss: () => void, onRestartWorld: () => void): void {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.overlayElement.classList.add('hidden');
    this.overlayElement.style.display = 'none';
    this.overlayElement.classList.remove('dark-backdrop');
    this.containerElement.classList.remove('position-center');
    this.containerElement.style.display = 'none';

    this.isOpen = true;
    this.isDeathMenuActive = true;
    this.deathMenuSelection = 0;
    this.onRetryBossCallback = onRetryBoss;
    this.onRestartWorldCallback = onRestartWorld;

    this.deathMenuOverlay.classList.remove('hidden');
    this.deathMenuOverlay.style.display = 'flex';
    document.body.classList.remove('cursor-hidden');
    this.renderDeathMenu();
  }

  private renderDeathMenu(): void {
    this.deathMenuOpt0.classList.toggle('selected', this.deathMenuSelection === 0);
    this.deathMenuOpt1.classList.toggle('selected', this.deathMenuSelection === 1);
  }

  private confirmDeathMenu(index: number): void {
    const retryCb = this.onRetryBossCallback;
    const restartCb = this.onRestartWorldCallback;
    this.close();
    if (index === 0 && retryCb) {
      retryCb();
    } else if (index === 1 && restartCb) {
      restartCb();
    }
  }

  public close(): void {
    this.isOpen = false;
    this.resetDeathMenu();
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.overlayElement.classList.add('hidden');
    this.overlayElement.style.display = 'none';
    this.overlayElement.classList.remove('dark-backdrop');
    this.containerElement.classList.remove('position-center');
    this.containerElement.style.display = '';

    this.hideChoices();
    this.avatarBox.style.display = '';
    this.bodyElement.textContent = '';
    this.bodyElement.classList.remove('font-xlarge', 'font-compact', 'font-dense');
    this.hintElement.textContent = '';
    document.body.classList.add('cursor-hidden');
  }
}
