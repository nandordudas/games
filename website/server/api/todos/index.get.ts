const mockUserId = 1

export default eventHandler(async () => {
  const todos = await useDB()
    .select()
    .from(tables.todos)
    .where(eq(tables.todos.userId, mockUserId))
    .all()

  return todos
})
