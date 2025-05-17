Here's the fixed version with all missing closing brackets added:

```typescript
                        >
                          {DECISION_ROLES.map(r => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(m.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded"
                    >
                      <UserMinus className="h-5 w-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```