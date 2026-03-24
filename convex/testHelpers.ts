export function handlerOf<TArgs, TResult>(registered: unknown) {
  return (registered as {
    _handler: (ctx: unknown, args: TArgs) => TResult;
  })._handler;
}
