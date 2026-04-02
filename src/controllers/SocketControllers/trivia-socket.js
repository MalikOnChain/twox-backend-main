import config from '@/config';
import AnswerTrivia from '@/models/trivia/AnswerTrivia';
import LaunchTrivia from '@/models/trivia/LaunchTrivia';
import Questions from '@/models/trivia/Questions';
import { QUESTION_TYPE, TRIVIA_STATUS, LAUNCH_TYPE } from '@/types/trivia/trivia';
import { SocketError } from '@/utils/error/errors';
import { logger } from '@/utils/logger';

const EMIT_EVENTS = {
  ERROR: 'error',
  SERVICE_STATUS: 'service-status',
  START_TRIVIA: 'start-trivia',
  TRIVIA_RESULT: 'trivia-result',
  END_TRIVIA: 'end-trivia',
};

const LISTEN_EVENTS = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  ERROR: 'error',
  TRIGGER_TRIVIA: 'trigger-trivia',
  CLOSE_TRIVIA: 'close-trivia',
  ANSWER_TRIVIA: 'answer-trivia',
};

export class TriviaSocketService {
  static instance = null;

  constructor() {
    if (TriviaSocketService.instance) {
      return TriviaSocketService.instance;
    }

    this.isHealthy = false;
    this.connectedClients = new Map();
    this.healthCheckInterval = null;
    this.users = new Map();
    this.adminSocket = null;

    TriviaSocketService.instance = this;
  }

  init(namespace, cb) {
    try {
      this.namespace = namespace;

      // Add namespace middleware for basic checks
      this.namespace.use(this.middlewareHandler.bind(this));

      // Set up connection handling
      this.namespace.on(LISTEN_EVENTS.CONNECTION, async (socket) => {
        if (typeof cb === 'function') {
          cb(socket);
        }
        await this.handleConnection(socket);
      });

      // Start health monitoring
      this.startHealthCheck();

      this.isHealthy = true;
      logger.info(`TriviaSocketService initialized on route: ${namespace?.name}`);
    } catch (error) {
      logger.error('Failed to initialize TriviaSocketService:', error);
      throw error;
    }
  }

  async middlewareHandler(socket, next) {
    try {
      // Check service health
      if (!this.isHealthy) {
        return next(new SocketError('Service temporarily unavailable', 503));
      }

      next();
    } catch (error) {
      next(new SocketError('Middleware error', 500));
    }
  }

  async handleConnection(socket) {
    try {
      // Store client information
      this.connectedClients.set(socket.id, {
        id: socket.id,
        address: socket.handshake.address,
        connectedAt: new Date(),
      });

      // Setup disconnect handler
      socket.on(LISTEN_EVENTS.DISCONNECT, () => {
        this.handleDisconnect(socket);
      });

      // Setup error handler
      socket.on(LISTEN_EVENTS.ERROR, (error) => {
        this.handleError(socket, error);
      });

      if (socket.user?.id) {
        this.users.set(socket.user.id, {
          id: socket.id,
          userId: socket.user.id,
        });
      } else if (socket.shared) {
        this.adminSocket = socket.id;
      }

      // Setup other event handlers
      this.setupSocketHandlers(socket);
    } catch (error) {
      this.handleError(socket, error);
    }
  }

  handleDisconnect(socket) {
    try {
      if (socket.user?.id) {
        this.users.delete(socket.user?.id);
      } else if (socket.shared) {
        this.adminSocket = null;
      }
      this.connectedClients.delete(socket.id);
      logger.info(`Client disconnected: ${socket.id}`);
    } catch (error) {
      logger.error(`Error handling disconnect for ${socket.id}:`, error);
    }
  }

  handleError(socket, error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = error.code || 500;

    socket.emit(EMIT_EVENTS.ERROR, {
      message: errorMessage,
      code: errorCode,
    });

    logger.error(`Socket error for ${socket.id}:`, error);
  }

  setupSocketHandlers(socket) {
    socket.on(LISTEN_EVENTS.TRIGGER_TRIVIA, (triviaData) => this.onTriggerTrivia(socket, triviaData));
    socket.on(LISTEN_EVENTS.ANSWER_TRIVIA, (triviaData) => this.onAnswerTrivia(socket, triviaData));
    socket.on(LISTEN_EVENTS.CLOSE_TRIVIA, (triviaData) => this.onCloseTrivia(socket, triviaData));
  }

  async startTrivia(launchId, question, launchedBy) {
    const launchedAt = new Date().toISOString();
    logger.info(`Trivia ID:${launchId} is launched at ${launchedAt}`);
    await this.namespace.emit(EMIT_EVENTS.START_TRIVIA, {
      launchId: launchId,
      questionId: question._id,
      questionText: question.questionText,
      questionType: question.questionType,
      answers: question.questionType === QUESTION_TYPE.MULTIPLE_CHOICE ? question.answers : [],
      launchedBy,
      questionTypeOptions: question.questionTypeOptions,
      cooldown: question.cooldown,
      timeLimit: question.timeLimit,
      launchedAt,
    });

    await LaunchTrivia.updateOne(
      { _id: launchId },
      { $set: { status: TRIVIA_STATUS.ACTIVE, launchedAt: new Date(launchedAt).valueOf() } }
    );
    if (question.timeLimit > 0) {
      setTimeout(
        async () => {
          await this.namespace.emit(EMIT_EVENTS.END_TRIVIA, launchId);
          await LaunchTrivia.updateOne({ _id: launchId }, { $set: { status: TRIVIA_STATUS.EXPIRED } });
        },
        (question.cooldown + question.timeLimit) * 1000
      );
    }
  }

  async onTriggerTrivia(socket, triviaData) {
    try {
      if (!this.validateTriviaData(triviaData)) {
        throw new SocketError('Invalid Trivia Data', 400);
      }
      const { trivia: id, launchedBy } = triviaData;
      const launchedTrivia = await LaunchTrivia.findById(id);
      if (!launchedTrivia) {
        throw new SocketError('Trivia not found', 404);
      }

      const question = await Questions.findById(launchedTrivia.questionId);

      if (question.launchType === LAUNCH_TYPE.SCHEDULED && question.launchTime) {
        const launchTimeMs = new Date(question.launchTime).getTime();
        const nowMs = Date.now();
        const delay = launchTimeMs - nowMs;

        if (delay > 0) {
          logger.info(`Scheduling Trivia ID:${id} to start in ${delay}ms (at ${new Date(launchTimeMs).toISOString()})`);
          setTimeout(async () => {
            logger.info(`Delayed start fired for Trivia ID:${id}`);
            await this.startTrivia(launchedTrivia._id, question, launchedBy);
          }, delay);
        } else {
          logger.warn(`Scheduled time ${question.launchTime} is in the past; starting immediately.`);
          await this.startTrivia(launchedTrivia._id, question, launchedBy);
        }
      } else {
        // immediate launch
        await this.startTrivia(launchedTrivia._id, question, launchedBy);
      }
    } catch (error) {
      logger.error('Error in onTriggerTrivia:', error);
      socket.emit(EMIT_EVENTS.ERROR, { message: 'Failed to fetch trivia', code: 500 });
    }
  }

  async onAnswerTrivia(socket, triviaData) {
    try {
      const { launchId, questionId, answers } = triviaData;
      if (!launchId || !questionId || !answers) {
        throw new SocketError('Invalid Trivia Data', 400);
      }
      if (!socket.user?.id) {
        throw new SocketError('You are not authorized to answer trivia', 404);
      }
      const launchedTrivia = await LaunchTrivia.findById(launchId);
      if (!launchedTrivia) {
        throw new SocketError('Trivia not found', 404);
      }
      if (launchedTrivia.status === TRIVIA_STATUS.EXPIRED) {
        await this.namespace.to(socket.id).emit(EMIT_EVENTS.TRIVIA_RESULT, { launchId, result: 'expired' });
      }
      logger.info(triviaData);
      const checkOld = await AnswerTrivia.find({ launchId, questionId, userId: socket.user?.id }).countDocuments();
      if (checkOld > 0) {
        await this.namespace.to(socket.id).emit(EMIT_EVENTS.TRIVIA_RESULT, { launchId, result: 'already_answered' });
        return;
      }
      const answer = await AnswerTrivia.create({
        launchId,
        questionId,
        answers,
        userId: socket.user?.id,
        answeredAt: Date.now(),
      });

      await this.namespace.to(this.adminSocket).emit(EMIT_EVENTS.TRIVIA_RESULT, answer);
      await this.namespace
        .to(socket.id)
        .emit(EMIT_EVENTS.TRIVIA_RESULT, { launchId, result: answer.isCorrect ? 'correct' : 'incorrect' });
    } catch (error) {
      logger.error('Error fetching trivia:', error);
      socket.emit(EMIT_EVENTS.ERROR, { message: 'Failed to fetch trivia', code: 500 });
    }
  }

  async onCloseTrivia(socket, triviaData) {
    try {
      if (!this.validateTriviaData(triviaData)) {
        throw new SocketError('Invalid Trivia Data', 400);
      }
      const { trivia } = triviaData;
      const launchedTrivia = await LaunchTrivia.findById(trivia);
      if (!launchedTrivia) {
        throw new SocketError('Trivia not found', 404);
      }

      await this.namespace.emit(EMIT_EVENTS.END_TRIVIA, trivia);
      await LaunchTrivia.updateOne({ _id: trivia }, { $set: { status: TRIVIA_STATUS.EXPIRED } });
    } catch (error) {
      logger.error('Error fetching trivia:', error);
      socket.emit(EMIT_EVENTS.ERROR, { message: 'Failed to fetch trivia', code: 500 });
    }
  }

  validateTriviaData(triviaData) {
    const { trivia, launchedBy, checkSum } = triviaData;
    if (!trivia || !launchedBy || !checkSum) {
      throw new SocketError('Invalid trivia data', 400);
    }
    const input = trivia + launchedBy;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32-bit integer
    }
    return hash === checkSum;
  }

  startHealthCheck() {
    this.healthCheckInterval = setInterval(() => {
      try {
        // Implement health check logic here
        this.isHealthy = true;
        this.namespace.emit(EMIT_EVENTS.SERVICE_STATUS, { healthy: this.isHealthy });
      } catch (error) {
        logger.error('Health check failed:', error);
        this.isHealthy = false;
      }
    }, config.healthCheckInterval || 30000);
  }

  cleanup() {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      this.connectedClients.clear();
      this.rooms.clear();

      if (this.namespace) {
        this.namespace.removeAllListeners();
      }

      this.isHealthy = false;
      logger.info('TriviaSocketService cleaned up');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  static getInstance() {
    if (!TriviaSocketService.instance) {
      TriviaSocketService.instance = new TriviaSocketService();
    }
    return TriviaSocketService.instance;
  }
}

// Create singleton instance
const triviaSocketService = new TriviaSocketService();
export default triviaSocketService;
