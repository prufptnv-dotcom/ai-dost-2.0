class ReasoningStreamFilter {
    constructor(onThought, onContent) {
        this.onThought = onThought;
        this.onContent = onContent;
        this.inThinkTag = false;
        this.buffer = '';
        this.hasEmittedThought = false;
    }

    pushReasoningDelta(reasoningText) {
        if (reasoningText) {
            this.hasEmittedThought = true;
            this.onThought(reasoningText);
        }
    }

    pushContentDelta(text) {
        if (!text) return;
        this.buffer += text;

        while (this.buffer.length > 0) {
            if (!this.inThinkTag) {
                const thinkStart = this.buffer.indexOf('<think>');
                if (thinkStart === -1) {
                    const partialMatch = this.buffer.match(/<t?h?i?n?k?$/i);
                    if (partialMatch && partialMatch.index > 0) {
                        const safeText = this.buffer.slice(0, partialMatch.index);
                        this.buffer = this.buffer.slice(partialMatch.index);
                        this.onContent(safeText);
                        break;
                    } else if (partialMatch && partialMatch.index === 0) {
                        break;
                    } else {
                        this.onContent(this.buffer);
                        this.buffer = '';
                    }
                } else {
                    if (thinkStart > 0) {
                        this.onContent(this.buffer.slice(0, thinkStart));
                    }
                    this.inThinkTag = true;
                    this.hasEmittedThought = true;
                    this.buffer = this.buffer.slice(thinkStart + 7);
                }
            } else {
                const thinkEnd = this.buffer.indexOf('</think>');
                if (thinkEnd === -1) {
                    const partialEndMatch = this.buffer.match(/<\/?t?h?i?n?k?>?$/i);
                    if (partialEndMatch && partialEndMatch.index > 0) {
                        const safeThought = this.buffer.slice(0, partialEndMatch.index);
                        this.buffer = this.buffer.slice(partialEndMatch.index);
                        this.onThought(safeThought);
                        break;
                    } else if (partialEndMatch && partialEndMatch.index === 0) {
                        break;
                    } else {
                        this.onThought(this.buffer);
                        this.buffer = '';
                    }
                } else {
                    const thoughtPart = this.buffer.slice(0, thinkEnd);
                    if (thoughtPart) this.onThought(thoughtPart);
                    this.inThinkTag = false;
                    this.buffer = this.buffer.slice(thinkEnd + 8);
                }
            }
        }
    }

    flush() {
        if (this.buffer.length > 0) {
            if (this.inThinkTag) {
                this.onThought(this.buffer);
            } else {
                this.onContent(this.buffer);
            }
            this.buffer = '';
        }
    }
}

module.exports = { ReasoningStreamFilter };
