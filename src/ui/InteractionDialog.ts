export interface DialogData {
  title: string;
  context: string;
  sageMessage: string;
  optionA: string;
  optionB: string;
  correctOption: 'A' | 'B';
  goodFeedback: string;
  badFeedback: string;
  onSuccess?: () => void;
}

export class InteractionDialog {
  public isOpen: boolean = false;
  public currentData: DialogData | null = null;

  private overlayElement: HTMLElement;
  private cardElement: HTMLElement;
  private titleElement: HTMLElement;
  private textElement: HTMLElement;
  private btnA: HTMLButtonElement;
  private btnB: HTMLButtonElement;
  private feedbackElement: HTMLElement;

  constructor(container: HTMLElement) {
    this.overlayElement = document.createElement('div');
    this.overlayElement.className = 'dialog-overlay hidden';

    this.cardElement = document.createElement('div');
    this.cardElement.className = 'dialog-card';

    this.titleElement = document.createElement('h2');
    this.titleElement.className = 'dialog-title';

    this.textElement = document.createElement('p');
    this.textElement.className = 'dialog-text';

    const btnContainer = document.createElement('div');
    btnContainer.className = 'dialog-buttons';

    this.btnA = document.createElement('button');
    this.btnA.className = 'dialog-btn';
    this.btnA.onclick = () => this.selectOption('A');

    this.btnB = document.createElement('button');
    this.btnB.className = 'dialog-btn';
    this.btnB.onclick = () => this.selectOption('B');

    btnContainer.appendChild(this.btnA);
    btnContainer.appendChild(this.btnB);

    this.feedbackElement = document.createElement('div');
    this.feedbackElement.className = 'dialog-feedback hidden';

    this.cardElement.appendChild(this.titleElement);
    this.cardElement.appendChild(this.textElement);
    this.cardElement.appendChild(btnContainer);
    this.cardElement.appendChild(this.feedbackElement);

    this.overlayElement.appendChild(this.cardElement);
    container.appendChild(this.overlayElement);
  }

  public show(data: DialogData): void {
    this.currentData = data;
    this.isOpen = true;
    this.titleElement.textContent = data.title;
    this.textElement.textContent = `${data.context}\n\n💡 Mędrzec: "${data.sageMessage}"`;
    this.btnA.textContent = `A: ${data.optionA}`;
    this.btnB.textContent = `B: ${data.optionB}`;
    this.feedbackElement.className = 'dialog-feedback hidden';
    this.overlayElement.classList.remove('hidden');
  }

  public close(): void {
    this.isOpen = false;
    this.currentData = null;
    this.overlayElement.classList.add('hidden');
  }

  private selectOption(choice: 'A' | 'B'): void {
    if (!this.currentData) return;

    const isCorrect = choice === this.currentData.correctOption;
    this.feedbackElement.classList.remove('hidden');

    if (isCorrect) {
      this.feedbackElement.className = 'dialog-feedback success';
      this.feedbackElement.textContent = `✓ ${this.currentData.goodFeedback} Brama została otwarta!`;
      if (this.currentData.onSuccess) {
        this.currentData.onSuccess();
      }
      setTimeout(() => this.close(), 1800);
    } else {
      this.feedbackElement.className = 'dialog-feedback error';
      this.feedbackElement.textContent = `✗ ${this.currentData.badFeedback} Zastanów się i spróbuj ponownie.`;
    }
  }
}
