import { useCallback, useState } from "react";

interface FormErrors {
  [key: string]: string;
}

interface UseFormProps<T> {
  initialValues: T;
  validate?: (values: T) => FormErrors;
  onSubmit: (values: T) => Promise<void>;
}

type SetValue<T> = T[keyof T];

export function useForm<T extends object>({
  initialValues,
  validate,
  onSubmit,
}: UseFormProps<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = useCallback(
    <K extends keyof T>(name: K, value: SetValue<T>) => {
      setValues((previousValues) => ({ ...previousValues, [name]: value }));

      if (errors[name as string]) {
        setErrors((previousErrors) => {
          const nextErrors = { ...previousErrors };
          delete nextErrors[name as string];
          return nextErrors;
        });
      }
    },
    [errors],
  );

  const handleBlur = useCallback(
    (name: keyof T) => {
      setTouched((previousTouched) => ({ ...previousTouched, [name]: true }));

      if (!validate) return;

      const validationErrors = validate(values);
      if (validationErrors[name as string]) {
        setErrors((previousErrors) => ({
          ...previousErrors,
          [name as string]: validationErrors[name as string],
        }));
      }
    },
    [values, validate],
  );

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();

      if (validate) {
        const validationErrors = validate(values);
        if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          setTouched(
            Object.keys(values).reduce<Record<string, boolean>>((acc, key) => {
              acc[key] = true;
              return acc;
            }, {}),
          );
          return;
        }
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validate, onSubmit],
  );

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setValues,
  };
}


