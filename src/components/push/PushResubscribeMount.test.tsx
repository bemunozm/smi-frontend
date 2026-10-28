import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PushResubscribeMount } from './PushResubscribeMount';

const { resubscribeMock, useCurrentUserMock } = vi.hoisted(() => ({
  resubscribeMock: vi.fn().mockResolvedValue(undefined),
  useCurrentUserMock: vi.fn(),
}));

vi.mock('../../lib/push-device', () => ({
  resubscribeIfOptedIn: (...args: unknown[]) => resubscribeMock(...args),
}));

vi.mock('../../hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock() as unknown,
}));

function renderMount() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route element={<PushResubscribeMount />}>
          <Route element={<div>hijo</div>} path="/" />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  cleanup();
  resubscribeMock.mockClear();
});

describe('PushResubscribeMount', () => {
  it('con sesión confirmada llama resubscribeIfOptedIn(user.id) una vez y renderiza el hijo', async () => {
    useCurrentUserMock.mockReturnValue({
      user: { id: 'u1' },
      isAuthenticated: true,
      isOfflineSnapshot: false,
    });

    renderMount();

    expect(screen.getByText('hijo')).toBeTruthy();
    await waitFor(() => expect(resubscribeMock).toHaveBeenCalledTimes(1));
    expect(resubscribeMock).toHaveBeenCalledWith('u1');
  });

  it('no llama con isOfflineSnapshot true ni sin sesión', () => {
    useCurrentUserMock.mockReturnValue({
      user: { id: 'u1' },
      isAuthenticated: true,
      isOfflineSnapshot: true,
    });
    renderMount();

    useCurrentUserMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isOfflineSnapshot: false,
    });
    renderMount();

    expect(resubscribeMock).not.toHaveBeenCalled();
  });
});
