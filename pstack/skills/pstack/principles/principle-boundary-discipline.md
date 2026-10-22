# Boundary discipline

When data crosses a system boundary, such as command-line arguments, configuration,
network input, or an external API:

- Check raw input as it enters and convert it into types that represent the
  application's data and rules.
- Rely on those checks inside the system instead of repeating the same validation.
- Check again when data comes from another untrusted source or can no longer
  be assumed valid.
- Use application concepts in public interfaces. Keep network, storage, and
  framework-specific types inside the code that connects to those systems.
- Keep business functions pure: compute outputs from inputs without reading
  or changing outside state. Keep input/output handling and framework code
  around those functions.
- Handle invalid input and external-system failures explicitly. Pass other
  errors to the code responsible for handling them.

**Check:** Can the business behavior be tested without the framework? Can the
code that handles input/output simply call the relevant function?

Related: [Model the Domain](principle-model-the-domain.md) defines the valid
states and rules the input checks need to protect.
