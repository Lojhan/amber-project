import type { RequestContext } from "../context.js";

export type Command<C, R> = (context: RequestContext, command: C) => Promise<R>;
export type Query<C, R> = (context: RequestContext, query: C) => Promise<R>;

export interface CommandHandler<C, R> {
  execute(context: RequestContext, command: C): Promise<R>;
}

export interface QueryHandler<Q, R> {
  execute(context: RequestContext, query: Q): Promise<R>;
}

export interface PublicCommandHandler<C, R> {
  execute(command: C): Promise<R>;
}

export interface PublicQueryHandler<Q, R> {
  execute(query: Q): Promise<R>;
}
