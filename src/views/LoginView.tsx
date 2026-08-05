import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Button, Card, FieldError, Input, Label, Spinner, TextField } from '@heroui/react';

import { signIn } from '../lib/auth-client';

const loginSchema = z.object({
  email: z.string().min(1, 'El email es obligatorio').email('Ingresa un email válido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/** Hint de credenciales de prueba, solo visible en build de desarrollo. */
const SHOW_DEV_HINT = import.meta.env.DEV;

export function LoginView() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginFormValues): Promise<void> => {
    setFormError(null);
    const { error } = await signIn.email({ email: values.email, password: values.password });

    if (error) {
      setFormError(error.message ?? 'No se pudo iniciar sesión. Verifica tus credenciales.');
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <Card.Header className="gap-3">
          <div className="flex w-6 shrink-0 flex-col gap-1">
            <span className="h-0.5 w-6 bg-foreground" />
            <span className="h-0.5 w-4 bg-accent" />
            <span className="h-0.5 w-6 bg-foreground" />
          </div>
          <span className="text-[11px] font-medium tracking-[0.14em] text-(--eyebrow-color) uppercase">
            SMI · Acceso
          </span>
          <Card.Title className="font-display text-[28px] font-semibold tracking-[-0.03em] text-foreground">
            Iniciar sesión
          </Card.Title>
          <Card.Description>Sistema de Mantenimiento e Inventario</Card.Description>
        </Card.Header>

        <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <Card.Content>
            <div className="flex flex-col gap-4">
              {formError ? (
                <div
                  className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground"
                  role="alert"
                >
                  {formError}
                </div>
              ) : null}

              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.email}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    type="email"
                    value={field.value}
                  >
                    <Label>Email</Label>
                    <Input autoComplete="email" autoFocus placeholder="admin@smi.local" />
                    {errors.email ? <FieldError>{errors.email.message}</FieldError> : null}
                  </TextField>
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <TextField
                    fullWidth
                    isInvalid={!!errors.password}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={field.onChange}
                    type="password"
                    value={field.value}
                  >
                    <Label>Contraseña</Label>
                    <Input autoComplete="current-password" placeholder="••••••••" />
                    {errors.password ? <FieldError>{errors.password.message}</FieldError> : null}
                  </TextField>
                )}
              />
            </div>
          </Card.Content>

          <Card.Footer className="mt-2 flex-col gap-3">
            <Button className="w-full" isPending={isSubmitting} type="submit">
              {({ isPending }) => (isPending ? <Spinner color="current" size="sm" /> : 'Ingresar')}
            </Button>
            {SHOW_DEV_HINT ? (
              <p className="text-center text-xs text-muted-foreground">Dev: admin@smi.local / Smi123456!</p>
            ) : null}
          </Card.Footer>
        </form>
      </Card>
    </main>
  );
}
